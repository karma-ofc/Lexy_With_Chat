import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import chatApi from '../chatApi';

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function normalizeDeckCards(cards = []) {
  return cards
    .map((card) => ({
      front: String(card.front || card.word || '').trim(),
      back: String(card.back || card.translation || '').trim()
    }))
    .filter((card) => card.front && card.back);
}

function makePreview(message) {
  if (!message) return 'Начните диалог';
  if (message.message_type === 'deck' && message.deck?.name) return `Колода: ${message.deck.name}`;
  if (message.message_type === 'photo') return 'Фото';
  return message.text || 'Сообщение';
}

function makeReplyPreview(message) {
  if (!message) return '';
  if (message.message_type === 'deck' && message.deck?.name) return `Колода: ${message.deck.name}`;
  if (message.message_type === 'photo') return 'Фото';
  return message.text || 'Сообщение';
}

function makeMessageSearchText(message) {
  if (!message) return '';
  return [
    message.text,
    message.sender?.name,
    message.sender?.username,
    message.deck?.name,
    message.photo?.name,
    makePreview(message)
  ].filter(Boolean).join(' ').toLowerCase();
}

function normalizeSearchQuery(value) {
  return String(value || '').trim().toLowerCase();
}

function messageMatchesSearch(message, query) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return false;

  const haystack = makeMessageSearchText(message);
  if (haystack.startsWith(normalizedQuery)) {
    return true;
  }

  return haystack.split(/\s+/).some((word) => word.startsWith(normalizedQuery));
}

function getMessageStatus(message, currentUserId) {
  if (!message || Number(message.sender_id) !== Number(currentUserId)) return null;
  return message.read_at ? 'прочитано' : 'доставлено';
}

function withReplyFallback(message, replyTo) {
  if (!message) return message;
  if (message.reply_to || !replyTo) return message;
  return { ...message, reply_to: replyTo };
}

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать фото'));
    reader.readAsDataURL(file);
  });
}

export default function Chat({ currentUser, socket, onShowNotification, onUnreadCountChange }) {
  const [users, setUsers] = useState([]);
  const [threads, setThreads] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showDeckPicker, setShowDeckPicker] = useState(false);
  const [myDecks, setMyDecks] = useState([]);
  const [deckLoading, setDeckLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [deleteModalMessageId, setDeleteModalMessageId] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [showRenameGroupModal, setShowRenameGroupModal] = useState(false);
  const [renameGroupName, setRenameGroupName] = useState('');
  const [showLeaveGroupConfirm, setShowLeaveGroupConfirm] = useState(false);
  const bottomRef = useRef(null);
  const photoInputRef = useRef(null);
  const socketRef = useRef(socket || null);
  const activeUserRef = useRef(activeUserId);
  const activeGroupRef = useRef(activeGroupId);
  const typingTimeoutRef = useRef(null);
  const registeredSocketKeyRef = useRef('');

  useEffect(() => {
    socketRef.current = socket || null;
    const socketId = socketRef.current?.id || '';
    const userId = currentUser?.id || '';
    const registrationKey = `${socketId}:${userId}`;
    if (socketRef.current && currentUser?.id && registeredSocketKeyRef.current !== registrationKey) {
      registeredSocketKeyRef.current = registrationKey;
      socketRef.current.emit('register', currentUser.id);
    }
  }, [socket, currentUser?.id]);

  useEffect(() => {
    activeUserRef.current = activeUserId;
  }, [activeUserId]);

  useEffect(() => {
    activeGroupRef.current = activeGroupId;
  }, [activeGroupId]);

  const totalUnread = useMemo(
    () => threads.reduce((sum, thread) => sum + Number(thread.unread_count || 0), 0),
    [threads]
  );

  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(totalUnread);
    }
  }, [onUnreadCountChange, totalUnread]);

  useEffect(() => {
    let cancelled = false;

    async function loadChat() {
      try {
        setLoading(true);
        const [usersResponse, threadsResponse, groupsResponse] = await Promise.all([
          api.getChatUsers().catch(err => ({ users: [] })),
          chatApi.getThreads().catch(err => ({ threads: [] })),
          chatApi.getGroups().catch(err => ({ groups: [] }))
        ]);

        if (cancelled) return;

        const loadedUsers = Array.isArray(usersResponse?.users) ? usersResponse.users : [];
        const loadedThreads = Array.isArray(threadsResponse?.threads) ? threadsResponse.threads : [];
        const loadedGroups = Array.isArray(groupsResponse?.groups) ? groupsResponse.groups : [];

        const threadMap = new Map(loadedThreads.map((thread) => [Number(thread.participant_id), thread]));
        const mergedUsers = loadedUsers.map((user) => ({
          ...user,
          thread: threadMap.get(Number(user.id)) || null
        }));

        setUsers(mergedUsers);
        setThreads(loadedThreads);
        setGroups(loadedGroups);

        const firstActive = loadedThreads[0]?.participant_id || loadedGroups[0]?.id || loadedUsers[0]?.id || null;
        if (firstActive && loadedThreads.length > 0) {
          setActiveUserId(Number(firstActive));
        } else if (loadedGroups.length > 0) {
          setActiveGroupId(Number(loadedGroups[0].id));
        }
      } catch (error) {
        console.error('loadChat error:', error);
        if (!cancelled && onShowNotification) {
          onShowNotification(error.message || 'Не удалось загрузить чат', 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadChat();

    return () => {
      cancelled = true;
    };
  }, [onShowNotification]);

  const activeUser = useMemo(
    () => users.find((user) => Number(user.id) === Number(activeUserId)) || null,
    [users, activeUserId]
  );

  const activeGroup = useMemo(
    () => groups.find((group) => Number(group.id) === Number(activeGroupId)) || null,
    [groups, activeGroupId]
  );

  useEffect(() => {
    if (activeGroup?.name) {
      setRenameGroupName(activeGroup.name);
    }
  }, [activeGroup?.id, activeGroup?.name]);

  useEffect(() => {
    setMessageSearch('');
  }, [activeUserId, activeGroupId]);

  const enrichMessagesWithSenders = (messages) => {
    return messages.map((message) => {
      const sender = users.find((user) => Number(user.id) === Number(message.sender_id));
      return {
        ...message,
        sender: sender || null
      };
    });
  };

  const loadMessages = async (participantId, groupId) => {
    try {
      if (participantId) {
        const response = await chatApi.getMessages(participantId);
        const messages = Array.isArray(response?.messages) ? response.messages : [];
        setMessages(enrichMessagesWithSenders(messages));
        setThreads((prev) => prev.map((thread) => (
          Number(thread.participant_id) === Number(participantId)
            ? { ...thread, unread_count: 0 }
            : thread
        )));
        socketRef.current?.emit('chat:mark_read', { participantId });
      } else if (groupId) {
        const response = await chatApi.getGroupMessages(groupId);
        const messages = Array.isArray(response?.messages) ? response.messages : [];
        setMessages(enrichMessagesWithSenders(messages));
        // НАДО: отметить групповые сообщения как прочитанными
      }
    } catch (error) {
      console.error('loadMessages error:', error);
      if (onShowNotification) {
        const errorMessage = participantId
          ? (error.message || 'Не удалось загрузить сообщения')
          : (error.message || 'Не удалось загрузить сообщения группы');
        onShowNotification(errorMessage, 'error');
      }
      // Устанавливаем пустые сообщения, чтобы избежать падения
      setMessages([]);
    }
  };

  useEffect(() => {
    try {
      if (activeUserId) {
        setActiveGroupId(null);
        loadMessages(activeUserId, null);
      } else if (activeGroupId) {
        setActiveUserId(null);
        loadMessages(null, activeGroupId);
      }
    } catch (error) {
      console.error('Active chat change error:', error);
      // Сбрасываем к безопасному состоянию
      setActiveUserId(null);
      setActiveGroupId(null);
      setMessages([]);
      if (onShowNotification) {
        onShowNotification('Ошибка при загрузке чата', 'error');
      }
    }
  }, [activeUserId, activeGroupId]);

  useEffect(() => {
    const activeSocket = socketRef.current;
    if (!activeSocket) return undefined;

    const handleNewMessage = async (message) => {
      // Обрабатываем групповые сообщения
      if (message.group_id) {
        setGroups((prev) => {
          const targetGroup = prev.find((group) => Number(group.id) === Number(message.group_id));
          if (!targetGroup) return prev;

          const updatedGroup = {
            ...targetGroup,
            last_message: message,
            last_message_at: message.created_at || targetGroup.last_message_at || targetGroup.created_at
          };

          return [...prev]
            .map((group) => (Number(group.id) === Number(message.group_id) ? updatedGroup : group))
            .sort((a, b) => new Date(b.last_message_at || b.created_at || 0) - new Date(a.last_message_at || a.created_at || 0));
        });

        if (Number(activeGroupRef.current) === Number(message.group_id)) {
          // Для групповых сообщений, если отправитель — текущий пользователь, не добавляем, так как сообщение уже добавлено из ответа API
          if (Number(message.sender_id) !== Number(currentUser?.id)) {
            setMessages((prev) => {
              if (prev.some((item) => item.id === message.id)) return prev;
              const sender = users.find((user) => Number(user.id) === Number(message.sender_id));
              return [...prev, { ...message, sender }];
            });
          }
        }
        // НАДО: обновить счётчик непрочитанных групповых сообщений
        return;
      }

      // Обрабатываем личные сообщения
      const otherParticipantId = Number(message.sender_id) === Number(currentUser?.id)
        ? Number(message.recipient_id)
        : Number(message.sender_id);

      setThreads((prev) => {
        const nextThread = {
          participant_id: otherParticipantId,
          last_message_at: message.created_at,
          unread_count: Number(message.sender_id) === Number(currentUser?.id)
            ? 0
            : (Number(activeUserRef.current) === otherParticipantId ? 0 : 1),
          last_message: message
        };

        const existingIndex = prev.findIndex((thread) => Number(thread.participant_id) === otherParticipantId);
        if (existingIndex === -1) {
          return [nextThread, ...prev];
        }

        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...nextThread,
          unread_count: Number(message.sender_id) === Number(currentUser?.id)
            ? 0
            : (Number(activeUserRef.current) === otherParticipantId ? 0 : Number(updated[existingIndex].unread_count || 0) + 1)
        };
        return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
      });

      if (Number(activeUserRef.current) === otherParticipantId) {
        setMessages((prev) => {
          if (prev.some((item) => item.id === message.id)) return prev;
          const sender = users.find((user) => Number(user.id) === Number(message.sender_id));
          return [...prev, { ...message, sender }];
        });
        await chatApi.markThreadRead(otherParticipantId);
        activeSocket.emit('chat:mark_read', { participantId: otherParticipantId });
      }
    };

    const handleReadConfirmed = ({ participantId }) => {
      setThreads((prev) => prev.map((thread) => (
        Number(thread.participant_id) === Number(participantId)
          ? { ...thread, unread_count: 0 }
          : thread
      )));
    };

    const handleMessageUpdated = (updated) => {
      const sender = users.find((user) => Number(user.id) === Number(updated.sender_id));
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...updated, sender } : m))
      );
      if (updated.group_id) {
        updateGroupPreview(updated.group_id, (group) => ({
          ...group,
          last_message: { ...updated, sender },
          last_message_at: updated.created_at || group.last_message_at || group.created_at
        }));
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    const handleMessageDeletedSelf = ({ messageId, userId }) => {
      if (Number(userId) === Number(currentUser?.id)) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    };

    const handleTyping = ({ userId }) => {
      const numUserId = Number(userId);
      console.log('Received typing from', numUserId, 'activeUserId', activeUserId);
      setTypingUsers((prev) => {
        const next = { ...prev, [numUserId]: true };
        console.log('typingUsers updated to', next);
        return next;
      });
    };

    const handleStopTyping = ({ userId }) => {
      const numUserId = Number(userId);
      console.log('Received stop typing from', numUserId);
      setTypingUsers((prev) => {
        const next = { ...prev, [numUserId]: false };
        console.log('typingUsers updated to', next);
        return next;
      });
    };

    activeSocket.on('chat:new_message', handleNewMessage);
    activeSocket.on('chat:read_confirmed', handleReadConfirmed);
    activeSocket.on('chat:message_updated', handleMessageUpdated);
    activeSocket.on('chat:message_deleted', handleMessageDeleted);
    activeSocket.on('chat:message_deleted_self', handleMessageDeletedSelf);
    activeSocket.on('chat:typing', handleTyping);
    activeSocket.on('chat:stop_typing', handleStopTyping);

    return () => {
      activeSocket.off('chat:new_message', handleNewMessage);
      activeSocket.off('chat:read_confirmed', handleReadConfirmed);
      activeSocket.off('chat:message_updated', handleMessageUpdated);
      activeSocket.off('chat:message_deleted', handleMessageDeleted);
      activeSocket.off('chat:message_deleted_self', handleMessageDeletedSelf);
      activeSocket.off('chat:typing', handleTyping);
      activeSocket.off('chat:stop_typing', handleStopTyping);
    };
    }, [socket, currentUser?.id]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, activeUserId]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => {
      const haystack = `${user.name || ''} ${user.username || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [search, users]);

  // Левая панель: если поиск активен, показываем совпадающих пользователей и группы, иначе показываем пользователей с чатами и все группы (по потоку и группам)
  const leftList = useMemo(() => {
    const q = search.trim();
    if (q) {
      const query = q.toLowerCase();
      const matchingUsers = filteredUsers;
      const matchingGroups = groups.filter((group) => group.name.toLowerCase().includes(query));
      return [...matchingUsers, ...matchingGroups.map(g => ({ ...g, isGroup: true }))];
    }

    // Сопоставляем participant_id с потоком для быстрого поиска
    const threadMap = new Map(threads.map((t) => [Number(t.participant_id), t]));
    // Сортируем по массиву потоков (уже отсортирован по last_message_at)
    const threadUsers = threads
      .map((t) => users.find((u) => Number(u.id) === Number(t.participant_id)))
      .filter(Boolean);
    const allGroups = [...groups]
      .sort((a, b) => new Date(b.last_message_at || b.created_at || 0) - new Date(a.last_message_at || a.created_at || 0))
      .map(g => ({ ...g, isGroup: true }));
    return [...threadUsers, ...allGroups];
  }, [search, filteredUsers, threads, users, groups]);

  const visibleMessages = useMemo(() => {
    const query = normalizeSearchQuery(messageSearch);
    if (!query) return messages;
    return messages.filter((message) => messageMatchesSearch(message, query));
  }, [messageSearch, messages]);

  const activeGroupCanRename = Boolean(activeGroup && Number(activeGroup.creator_id) === Number(currentUser?.id));

  const currentThread = useMemo(
    () => threads.find((thread) => Number(thread.participant_id) === Number(activeUserId)) || null,
    [threads, activeUserId]
  );

  const handleSelectUser = (userId) => {
    setActiveUserId(Number(userId));
    setActiveGroupId(null);
  };

  const handleSelectGroup = (groupId) => {
    setActiveGroupId(Number(groupId));
    setActiveUserId(null);
  };

  const refreshThreads = async () => {
    const response = await chatApi.getThreads();
    setThreads(Array.isArray(response?.threads) ? response.threads : []);
  };

  const refreshGroups = async () => {
    const response = await chatApi.getGroups();
    setGroups(Array.isArray(response?.groups) ? response.groups : []);
  };

  const updateGroupPreview = (groupId, updater) => {
    setGroups((prev) => [...prev]
      .map((group) => (Number(group.id) === Number(groupId) ? updater(group) : group))
      .sort((a, b) => new Date(b.last_message_at || b.created_at || 0) - new Date(a.last_message_at || a.created_at || 0)));
  };

  const sendMessageNow = async () => {
    const text = String(messageText || '').trim();
    if ((!activeUserId && !activeGroupId) || !text || sending) return;

    setSending(true);
    try {
      const payload = {
        type: 'text',
        text,
      };
      if (replyToMessage) {
        payload.reply_to = {
          id: replyToMessage.id,
          message_type: replyToMessage.message_type,
          text: replyToMessage.text || '',
          deck: replyToMessage.deck || null,
          photo: replyToMessage.photo || null,
          sender_name: replyToMessage.sender?.name || replyToMessage.sender?.username || replyToMessage.sender_name || '',
          sender_username: replyToMessage.sender?.username || replyToMessage.sender_username || ''
        };
      }
      let response;
      if (activeUserId) {
        response = await chatApi.sendMessage(activeUserId, payload);
        await refreshThreads();
      } else {
        response = await chatApi.sendGroupMessage(activeGroupId, payload);
      }
      const newMessage = response?.message;
      if (newMessage) {
        const sender = users.find((user) => Number(user.id) === Number(newMessage.sender_id));
        setMessages((prev) => [...prev, withReplyFallback({ ...newMessage, sender }, payload.reply_to)]);
        if (activeGroupId) {
          updateGroupPreview(activeGroupId, (group) => ({
            ...group,
            last_message: newMessage,
            last_message_at: newMessage.created_at || group.last_message_at || group.created_at
          }));
        }
      }
      setMessageText('');
      setReplyToMessage(null);
      sendStopTyping();
    } catch (error) {
      if (onShowNotification) {
        onShowNotification(error.message || 'Не удалось отправить сообщение', 'error');
      }
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async (messageId) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message || !message.text) return;
    setEditingMessageId(messageId);
    setEditingText(message.text);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingText.trim()) return;
    try {
      const response = await chatApi.updateMessage(editingMessageId, editingText);
      if (response?.message) {
        const sender = users.find((user) => Number(user.id) === Number(response.message.sender_id));
        setMessages((prev) =>
          prev.map((m) => (m.id === editingMessageId ? { ...response.message, sender } : m))
        );
      }
      setEditingMessageId(null);
      setEditingText('');
      if (onShowNotification) {
        onShowNotification('Сообщение отредактировано');
      }
    } catch (error) {
      if (onShowNotification) {
        onShowNotification(error.message || 'Не удалось отредактировать сообщение', 'error');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleDeleteMessage = async (messageId, deleteFor) => {
    try {
      await chatApi.deleteMessage(messageId, deleteFor);
      if (deleteFor === 'all') {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      setDeleteModalMessageId(null);
      if (onShowNotification) {
        onShowNotification(`Сообщение удалено${deleteFor === 'all' ? ' для всех' : ' для вас'}`);
      }
    } catch (error) {
      if (onShowNotification) {
        onShowNotification(error.message || 'Не удалось удалить сообщение', 'error');
      }
    }
  };

  const loadMyDecks = async () => {
    setDeckLoading(true);
    try {
      const response = await api.getMyDecks();
      const decks = Array.isArray(response) ? response : (response?.decks || []);
      setMyDecks(decks);
    } catch (error) {
      if (onShowNotification) {
        onShowNotification(error.message || 'Не удалось загрузить колоды', 'error');
      }
    } finally {
      setDeckLoading(false);
    }
  };

  const handleOpenDeckPicker = async () => {
    setShowDeckPicker(true);
    if (!myDecks.length) {
      await loadMyDecks();
    }
  };

  const handleOpenPhotoPicker = () => {
    photoInputRef.current?.click();
  };

  const handleStartReply = (message) => {
    setReplyToMessage(message);
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  const handleScrollToReply = (replyToId) => {
    const element = document.querySelector(`[data-message-id="${replyToId}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const sendTyping = () => {
    if ((activeUserId || activeGroupId) && socketRef.current) {
      const targetId = activeUserId || activeGroupId;
      const isGroup = !!activeGroupId;
      console.log('Sending typing to', targetId, isGroup ? 'group' : 'user');
      socketRef.current.emit('chat:typing', { participantId: targetId, isGroup });
    }
  };

  const sendStopTyping = () => {
    if ((activeUserId || activeGroupId) && socketRef.current) {
      const targetId = activeUserId || activeGroupId;
      const isGroup = !!activeGroupId;
      console.log('Sending stop typing to', targetId, isGroup ? 'group' : 'user');
      socketRef.current.emit('chat:stop_typing', { participantId: targetId, isGroup });
    }
  };

  const handleTextareaInput = () => {
    sendTyping();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendStopTyping();
    }, 3000);
  };

  const handleTextareaBlur = () => {
    sendStopTyping();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handlePhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || (!activeUserId && !activeGroupId) || sending) return;

    if (!file.type.startsWith('image/')) {
      if (onShowNotification) {
        onShowNotification('Можно отправлять только изображения', 'error');
      }
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      if (onShowNotification) {
        onShowNotification('Фото не должно превышать 10 МБ', 'error');
      }
      return;
    }

    try {
      setSending(true);
      const dataUrl = await fileToDataUrl(file);
      const payload = {
        type: 'photo',
        photo: {
          name: file.name,
          mimeType: file.type,
          size: file.size,
          dataUrl
        },
        reply_to: replyToMessage ? {
          id: replyToMessage.id,
          message_type: replyToMessage.message_type,
          text: replyToMessage.text || '',
          deck: replyToMessage.deck || null,
          photo: replyToMessage.photo || null,
          sender_name: replyToMessage.sender?.name || replyToMessage.sender?.username || replyToMessage.sender_name || '',
          sender_username: replyToMessage.sender?.username || replyToMessage.sender_username || ''
        } : null
      };
      let response;
      if (activeUserId) {
        response = await chatApi.sendMessage(activeUserId, payload);
        await refreshThreads();
      } else {
        response = await chatApi.sendGroupMessage(activeGroupId, payload);
      }

      const newMessage = response?.message;
      if (newMessage) {
        const sender = users.find((user) => Number(user.id) === Number(newMessage.sender_id));
        setMessages((prev) => [...prev, withReplyFallback({ ...newMessage, sender }, payload.reply_to)]);
        if (activeGroupId) {
          updateGroupPreview(activeGroupId, (group) => ({
            ...group,
            last_message: newMessage,
            last_message_at: newMessage.created_at || group.last_message_at || group.created_at
          }));
        }
      }

      setReplyToMessage(null);
      if (onShowNotification) {
        onShowNotification('Фото отправлено');
      }
    } catch (error) {
      if (onShowNotification) {
        onShowNotification(error.message || 'Не удалось отправить фото', 'error');
      }
    } finally {
      setSending(false);
    }
  };

  const handleSendDeck = async (deck) => {
    if ((!activeUserId && !activeGroupId) || !deck) return;

    try {
      const cardsResponse = await api.getCards(deck.id);
      const cards = normalizeDeckCards(cardsResponse?.cards || []);
      if (!cards.length) {
        throw new Error('В колоде нет карточек для отправки');
      }

      const payload = {
        type: 'deck',
        deck: {
          name: deck.name,
          description: deck.description || '',
          cards,
          source_deck_id: deck.id,
          custom_image: deck.custom_image || deck.customImage || deck.image || deck.imageUrl || deck.image_url || null
        },
        reply_to: replyToMessage ? {
          id: replyToMessage.id,
          message_type: replyToMessage.message_type,
          text: replyToMessage.text || '',
          deck: replyToMessage.deck || null,
          photo: replyToMessage.photo || null,
          sender_name: replyToMessage.sender?.name || replyToMessage.sender?.username || replyToMessage.sender_name || '',
          sender_username: replyToMessage.sender?.username || replyToMessage.sender_username || ''
        } : null
      };
      let response;
      if (activeUserId) {
        response = await chatApi.sendMessage(activeUserId, payload);
        await refreshThreads();
      } else {
        response = await chatApi.sendGroupMessage(activeGroupId, payload);
      }

      const newMessage = response?.message;
      if (newMessage) {
        const sender = users.find((user) => Number(user.id) === Number(newMessage.sender_id));
        setMessages((prev) => [...prev, withReplyFallback({ ...newMessage, sender }, payload.reply_to)]);
        if (activeGroupId) {
          updateGroupPreview(activeGroupId, (group) => ({
            ...group,
            last_message: newMessage,
            last_message_at: newMessage.created_at || group.last_message_at || group.created_at
          }));
        }
      }

      setShowDeckPicker(false);
      setReplyToMessage(null);
      if (onShowNotification) {
        onShowNotification('Колода отправлена');
      }
    } catch (error) {
      if (onShowNotification) {
        onShowNotification(error.message || 'Не удалось отправить колоду', 'error');
      }
    }
  };

  const handleAddSharedDeck = async (deck) => {
    if (!deck?.name || !Array.isArray(deck.cards) || !deck.cards.length) return;

    try {
      const created = await api.createDeck(deck.name, deck.description || '', 'public');
      const createdDeckId = created?.deck?.id;
      if (!createdDeckId) {
        throw new Error('Не удалось создать колоду');
      }

      for (const card of deck.cards) {
        await api.createCard(createdDeckId, card.front, card.back);
      }

      const customImage = deck.custom_image || deck.customImage || deck.image || deck.imageUrl || deck.image_url || null;
      if (customImage) {
        try {
          await api.updateDeck(createdDeckId, deck.name, deck.description || '', customImage);
        } catch (e) {
          console.warn('Не удалось сохранить изображение колоды:', e);
        }
      }

      if (typeof window.refreshMyDecks === 'function') {
        window.refreshMyDecks();
      }

      if (onShowNotification) {
        onShowNotification(`Колода "${deck.name}" добавлена в библиотеку`);
      }
    } catch (error) {
      if (onShowNotification) {
        onShowNotification(error.message || 'Не удалось добавить колоду', 'error');
      }
    }
  };

  const handleSaveGroupRename = async () => {
    const nextName = String(renameGroupName || '').trim();
    if (!activeGroup || !nextName) return;

    try {
      const response = await chatApi.updateGroup(activeGroup.id, nextName);
      if (response?.group) {
        setGroups((prev) => prev.map((group) => (
          Number(group.id) === Number(activeGroup.id)
            ? { ...group, ...response.group }
            : group
        )));
      } else {
        await refreshGroups();
      }

      setShowRenameGroupModal(false);
      if (onShowNotification) {
        onShowNotification('Название группы изменено');
      }
    } catch (error) {
      if (onShowNotification) {
        onShowNotification(error.message || 'Не удалось изменить название группы', 'error');
      }
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeGroup) return;

    try {
      await chatApi.leaveGroup(activeGroup.id);
      await refreshGroups();

      const remainingGroups = groups.filter((group) => Number(group.id) !== Number(activeGroup.id));
      if (remainingGroups.length > 0) {
        setActiveGroupId(Number(remainingGroups[0].id));
        setActiveUserId(null);
      } else if (threads.length > 0) {
        setActiveGroupId(null);
        setActiveUserId(Number(threads[0].participant_id));
      } else {
        setActiveGroupId(null);
        setActiveUserId(null);
        setMessages([]);
      }

      setShowRenameGroupModal(false);
      setShowAddParticipantModal(false);

      if (onShowNotification) {
        onShowNotification('Вы вышли из группы');
      }
    } catch (error) {
      if (onShowNotification) {
        onShowNotification(error.message || 'Не удалось выйти из группы', 'error');
      }
    }
  };

  const confirmLeaveGroup = async () => {
    setShowLeaveGroupConfirm(false);
    await handleLeaveGroup();
  };

  if (loading) {
    return <div className="chat-page chat-page-loading">Загрузка чата...</div>;
  }

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header" style={{ marginBottom: '-10px' }}>
          <div>
            <div className="chat-eyebrow">Сообщения</div>
            <h2 style={{ marginTop: '6px' }}>Чат</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="chat-create-group-btn"
              onClick={() => setShowCreateGroupModal(true)}
              title="Создать группу"
            >
              +
            </button>
            <div className="chat-unread-pill">{totalUnread}</div>
          </div>
        </div>

        <label className="chat-search">
          <span>Поиск</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Имя или username"
          />
        </label>

        <div className="chat-user-list">
          {leftList.map((item) => {
            if (item.isGroup) {
              const isActive = Number(item.id) === Number(activeGroupId);
              return (
                <button
                  type="button"
                  key={`group-${item.id}`}
                  className={`chat-user-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectGroup(item.id)}
                >
                  <span className="chat-user-avatar">👥</span>
                  <span className="chat-user-meta">
                    <span className="chat-user-name-row">
                      <span className="chat-user-name">{item.name}</span>
                      <span className="chat-user-username">({Array.isArray(item.participants) ? item.participants.length : 0} участников)</span>
                    </span>
                    <span className="chat-user-preview">{makePreview(item.last_message)}</span>
                  </span>
                </button>
              );
            } else {
              const thread = threads.find((t) => Number(t.participant_id) === Number(item.id));
              const isActive = Number(item.id) === Number(activeUserId);
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`chat-user-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectUser(item.id)}
                >
                  <span className="chat-user-avatar">{item.avatar || '👤'}</span>
                  <span className="chat-user-meta">
                    <span className="chat-user-name-row">
                      <span className="chat-user-name">{item.name || item.username}</span>
                      <span className="chat-user-username">(@{item.username})</span>
                      {thread?.unread_count > 0 && <span className="chat-user-badge">{thread.unread_count}</span>}
                    </span>
                    <span className="chat-user-preview">{typingUsers[item.id] ? <span className="typing-animation">Печатает</span> : makePreview(thread?.last_message)}</span>
                  </span>
                </button>
              );
            }
          })}
        </div>
      </aside>

      <section className="chat-panel">
        {(activeUser || activeGroup) ? (
          <>
              <header className="chat-panel-header">
                <div className="chat-panel-user">
                  {activeGroup ? (
                    <>
                      <span className="chat-panel-avatar">👥</span>
                      <div>
                        <h3>{activeGroup.name}</h3>
                        <p>{Array.isArray(activeGroup.participants) ? activeGroup.participants.length : 0} участников</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                        {activeGroupCanRename && (
                          <button
                            type="button"
                            className="chat-add-participant-btn"
                            onClick={() => {
                              setRenameGroupName(activeGroup.name || '');
                              setShowRenameGroupModal(true);
                            }}
                            title="Редактировать название группы"
                          >
                            ✎
                          </button>
                        )}
                        <button
                          type="button"
                          className="chat-add-participant-btn"
                          onClick={() => setShowAddParticipantModal(true)}
                          title="Добавить участника"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="chat-add-participant-btn"
                          onClick={() => setShowLeaveGroupConfirm(true)}
                          title="Выйти из группы"
                        >
                          ↩
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="chat-panel-avatar">{activeUser.avatar || '👤'}</span>
                      <div>
                        <h3>{activeUser.name || activeUser.username}</h3>
                        <p>@{activeUser.username}</p>
                        {activeUserId && typingUsers[activeUserId] && <div className="typing-indicator"><span className="typing-animation">Печатает</span></div>}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', marginLeft: 'auto', width: 'min(420px, 100%)' }}>
                  {(activeUser || activeGroup) && (
                    <div style={{ width: '100%' }}>
                      <label className="chat-search" style={{ width: '100%' }}>
                        <input
                          type="search"
                          value={messageSearch}
                          onChange={(event) => setMessageSearch(event.target.value)}
                          placeholder="Поиск по сообщениям во всех чатах"
                        />
                      </label>
                    </div>
                  )}
                  <div className="chat-panel-meta">
                    {currentThread?.unread_count ? (
                      `${currentThread.unread_count} непрочит.`
                    ) : (
                      <>
                        <span>Онлайн чат</span>
                        <span className="chat-panel-status-dot" aria-hidden="true" />
                      </>
                    )}
                  </div>
                </div>
              </header>

            <div className="chat-messages">
              {visibleMessages.length === 0 ? (
                <div className="chat-empty-state">
                  <h3>{messageSearch.trim() ? 'Ничего не найдено' : 'Начните диалог'}</h3>
                  <p>{messageSearch.trim() ? 'Попробуйте другой запрос поиска.' : 'Отправьте сообщение или колоду, чтобы она появилась здесь и у собеседника.'}</p>
                </div>
              ) : (
                visibleMessages.map((message) => {
                  const isOwn = Number(message.sender_id) === Number(currentUser?.id);
                  const isSearchMatch = messageMatchesSearch(message, messageSearch);
                  const messageStatus = getMessageStatus(message, currentUser?.id);
                  return (
                    <article
                      key={message.id}
                      data-message-id={message.id}
                      className={`chat-message ${isOwn ? 'own' : 'incoming'} ${isSearchMatch ? 'chat-message-search-match' : ''}`}
                    >
                      <div className="chat-message-head">
                        <span className="chat-message-avatar">{message.sender?.avatar || (isOwn ? currentUser?.avatar : (activeUser?.avatar || '👤')) || '👤'}</span>
                        <div className="chat-message-nameblock">
                          <span className="chat-message-name">{message.sender?.name || message.sender?.username || (isOwn ? currentUser?.name : (activeUser?.name || activeUser?.username))}</span>
                          <span className="chat-message-time">{formatTime(message.created_at)}</span>
                        </div>
                        {!isOwn && (
                          <button
                            type="button"
                            className="chat-message-reply-btn"
                            onClick={() => handleStartReply(message)}
                            title="Ответить"
                          >
                            ↩
                          </button>
                        )}
                      </div>

                       {message.message_type === 'deck' && message.deck ? (
                         <div className="chat-message-content">
                           {message.reply_to && (
                             <div className="chat-message-quote" onClick={() => handleScrollToReply(message.reply_to.id)}>
                               <div className="chat-message-quote-title">{message.reply_to.sender_name || 'Пользователь'}</div>
                               <div className="chat-message-quote-text">{makeReplyPreview(message.reply_to)}</div>
                             </div>
                           )}
                          <div className="chat-deck-card">
                            <div className="chat-deck-title">{message.deck.name}</div>
                            {message.deck.description ? <div className="chat-deck-description">{message.deck.description}</div> : null}
                            <div className="chat-deck-stats">{message.deck.cards.length} карточек</div>
                            <button type="button" className="chat-deck-add" onClick={() => handleAddSharedDeck(message.deck)}>
                              Добавить в библиотеку
                            </button>
                          </div>
                        </div>
                       ) : message.message_type === 'photo' && message.photo ? (
                         <div className="chat-message-content">
                           {message.reply_to && (
                             <div className="chat-message-quote" onClick={() => handleScrollToReply(message.reply_to.id)}>
                               <div className="chat-message-quote-title">{message.reply_to.sender_name || 'Пользователь'}</div>
                               <div className="chat-message-quote-text">{makeReplyPreview(message.reply_to)}</div>
                             </div>
                           )}
                          <div className="chat-photo-card">
                            <img
                              className="chat-photo-image"
                              src={message.photo.dataUrl}
                              alt={message.photo.name || 'Фото'}
                            />
                            {message.photo.name ? <div className="chat-photo-name">{message.photo.name}</div> : null}
                          </div>
                        </div>
                       ) : (
                         <div className="chat-message-text">
                           {message.reply_to && (
                             <div className="chat-message-quote" onClick={() => handleScrollToReply(message.reply_to.id)}>
                               <div className="chat-message-quote-title">{message.reply_to.sender_name || 'Пользователь'}</div>
                               <div className="chat-message-quote-text">{makeReplyPreview(message.reply_to)}</div>
                             </div>
                           )}
                          <span>{message.text || 'Сообщение'}</span>
                        </div>
                      )}

                      {isOwn && (
                        <div className="chat-message-footer">
                          {message.message_type !== 'deck' && (
                            <div className="chat-message-actions">
                              {message.message_type === 'text' && (
                                <button
                                  type="button"
                                  className="chat-message-action-btn"
                                  onClick={() => handleEditMessage(message.id)}
                                  title="Редактировать"
                                >
                                  <Icon name="edit" />
                                </button>
                              )}
                              <button
                                type="button"
                                className="chat-message-action-btn"
                                onClick={() => setDeleteModalMessageId(message.id)}
                                title="Удалить"
                              >
                                <Icon name="trash" />
                              </button>
                            </div>
                          )}

                          <span
                            className={`chat-message-status ${messageStatus === 'прочитано' ? 'is-read' : 'is-delivered'}`}
                            title={messageStatus === 'прочитано' ? 'Прочитано' : 'Доставлено'}
                          >
                            <span><Icon name="check" /></span>
                            <span><Icon name="check" /></span>
                          </span>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="chat-composer">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoSelected}
              />
              {replyToMessage && (
                <div className="chat-reply-preview">
                  <div className="chat-reply-preview-meta">
                    <div className="chat-reply-preview-label">Ответ на сообщение</div>
                    <div className="chat-reply-preview-name">
                      {replyToMessage.sender?.name || replyToMessage.sender?.username || 'Пользователь'}
                    </div>
                    <div className="chat-reply-preview-text">{makeReplyPreview(replyToMessage)}</div>
                  </div>
                  <button type="button" className="chat-reply-preview-close" onClick={handleCancelReply} title="Отменить ответ">
                    ×
                  </button>
                </div>
              )}
              <div className="chat-composer-input">
                <textarea
                  value={messageText}
                  onChange={(event) => {
                    setMessageText(String(event.target.value).slice(0, 2000));
                    handleTextareaInput();
                  }}
                  onFocus={() => sendTyping()}
                  onBlur={handleTextareaBlur}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendMessageNow();
                    }
                  }}
                  placeholder={activeGroup ? "Напишите сообщение в группу..." : "Напишите сообщение..."}
                  rows={3}
                  maxLength={2000}
                />
                <div className="chat-char-count">{(messageText || '').length}/2000</div>
              </div>

              <div className="chat-composer-actions">
                <button type="button" className="chat-attach-button" onClick={handleOpenDeckPicker} style={{ marginRight: '2px' }}>
                  Отправить колоду
                </button>
                <button type="button" className="chat-attach-button" onClick={handleOpenPhotoPicker} title="Отправить фото">
                  @
                </button>
                <button type="button" className="chat-send-button" disabled={sending || !messageText.trim()} onClick={sendMessageNow} style={{ marginLeft: 'auto' }}>
                  {sending ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="chat-empty-state full">
            <h3>Выберите собеседника</h3>
            <p>Здесь появится история сообщений и кнопка отправки колоды.</p>
          </div>
        )}
      </section>

      {showDeckPicker && (
        <div className="chat-modal-backdrop" onClick={() => setShowDeckPicker(false)}>
          <div className="chat-modal" onClick={(event) => event.stopPropagation()}>
            <div className="chat-modal-header">
              <h3>Выберите колоду</h3>
              <button type="button" className="chat-modal-close" onClick={() => setShowDeckPicker(false)}>×</button>
            </div>

            <div className="chat-deck-list">
              {deckLoading ? (
                <div className="chat-deck-loading">Загрузка...</div>
              ) : myDecks.length ? (
                myDecks.map((deck) => (
                  <button key={deck.id} type="button" className="chat-deck-row" onClick={() => handleSendDeck(deck)}>
                    <span className="chat-deck-row-main">
                      <strong>{deck.name}</strong>
                      <span>{deck.description || 'Без описания'}</span>
                    </span>
                    <span className="chat-deck-row-count">{deck.cards_count || 0} карт</span>
                  </button>
                ))
              ) : (
                <div className="chat-deck-empty">У вас пока нет колод</div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingMessageId && (
        <div className="chat-modal-backdrop" onClick={handleCancelEdit}>
          <div className="chat-modal" onClick={(event) => event.stopPropagation()}>
            <div className="chat-modal-header">
              <h3>Редактировать сообщение</h3>
              <button type="button" className="chat-modal-close" onClick={handleCancelEdit}>×</button>
            </div>

            <textarea
              value={editingText}
              onChange={(event) => setEditingText(String(event.target.value).slice(0, 2000))}
              placeholder="Редактируйте сообщение"
              rows={4}
              maxLength={2000}
              style={{ width: '100%', marginBottom: '12px', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-primary)', resize: 'none' }}
            />
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {editingText.length}/2000
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="chat-attach-button" onClick={handleCancelEdit}>
                Отменить
              </button>
              <button type="button" className="chat-send-button" onClick={handleSaveEdit} disabled={!editingText.trim()}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalMessageId && (
        <div className="chat-modal-backdrop" onClick={() => setDeleteModalMessageId(null)}>
          <div className="chat-modal" onClick={(event) => event.stopPropagation()}>
            <div className="chat-modal-header">
              <h3>Удалить сообщение</h3>
              <button type="button" className="chat-modal-close" onClick={() => setDeleteModalMessageId(null)}>×</button>
            </div>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Выберите, как удалить сообщение:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                className="chat-send-button"
                onClick={() => handleDeleteMessage(deleteModalMessageId, 'self')}
                style={{ background: 'var(--warning)', color: '#000' }}
              >
                Удалить только у себя
              </button>
              <button
                type="button"
                className="chat-send-button"
                onClick={() => handleDeleteMessage(deleteModalMessageId, 'all')}
                style={{ background: 'var(--danger)', color: '#fff' }}
              >
                Удалить для всех
              </button>
              <button
                type="button"
                className="chat-attach-button"
                onClick={() => setDeleteModalMessageId(null)}
              >
                Отменить
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateGroupModal && (
        <div className="chat-modal-backdrop" onClick={() => setShowCreateGroupModal(false)}>
          <div className="chat-modal" onClick={(event) => event.stopPropagation()}>
            <div className="chat-modal-header">
              <h3>Создать группу</h3>
              <button type="button" className="chat-modal-close" onClick={() => setShowCreateGroupModal(false)}>×</button>
            </div>

            <input
              type="text"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="Название группы"
              maxLength={100}
              style={{ width: '100%', marginBottom: '16px', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-primary)' }}
            />

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="chat-attach-button" onClick={() => { setShowCreateGroupModal(false); setNewGroupName(''); }}>
                Отменить
              </button>
              <button
                type="button"
                className="chat-send-button"
                onClick={async () => {
                  if (!newGroupName.trim()) return;
                  try {
                    const response = await chatApi.createGroup(newGroupName.trim());
                    const newGroup = response?.group;
                    if (newGroup) {
                      setGroups((prev) => [newGroup, ...prev]);
                      setActiveGroupId(newGroup.id);
                      setActiveUserId(null);
                      setShowCreateGroupModal(false);
                      setNewGroupName('');
                      if (onShowNotification) {
                        onShowNotification('Группа создана');
                      }
                    }
                  } catch (error) {
                    if (onShowNotification) {
                      onShowNotification(error.message || 'Не удалось создать группу', 'error');
                    }
                  }
                }}
                disabled={!newGroupName.trim()}
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddParticipantModal && activeGroup && (
        <div className="chat-modal-backdrop" onClick={() => setShowAddParticipantModal(false)}>
          <div className="chat-modal" onClick={(event) => event.stopPropagation()}>
            <div className="chat-modal-header">
              <h3>Добавить участника в {activeGroup.name}</h3>
              <button type="button" className="chat-modal-close" onClick={() => setShowAddParticipantModal(false)}>×</button>
            </div>

            <input
              type="text"
              value={participantSearch}
              onChange={(event) => setParticipantSearch(event.target.value)}
              placeholder="Имя или username"
              style={{ width: '100%', marginBottom: '16px', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-primary)' }}
            />

            <div className="chat-user-list" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
              {users
                .filter((user) => !Array.isArray(activeGroup.participants) || !activeGroup.participants.includes(user.id) && (user.name?.toLowerCase().includes(participantSearch.toLowerCase()) || user.username?.toLowerCase().includes(participantSearch.toLowerCase())))
                .map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="chat-deck-row"
                    onClick={async () => {
                      try {
                        await chatApi.addParticipant(activeGroup.id, user.id);
                        setGroups((prev) => prev.map((g) => g.id === activeGroup.id ? { ...g, participants: [...g.participants, user.id] } : g));
                        setParticipantSearch('');
                        if (onShowNotification) {
                          onShowNotification(`${user.name || user.username} добавлен в группу`);
                        }
                      } catch (error) {
                        if (onShowNotification) {
                          onShowNotification(error.message || 'Не удалось добавить участника', 'error');
                        }
                      }
                    }}
                  >
                    <span className="chat-user-avatar">{user.avatar || '👤'}</span>
                    <span>{user.name || user.username} (@{user.username})</span>
                  </button>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="chat-attach-button" onClick={() => { setShowAddParticipantModal(false); setParticipantSearch(''); }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {showRenameGroupModal && activeGroup && (
        <div className="chat-modal-backdrop" onClick={() => setShowRenameGroupModal(false)}>
          <div className="chat-modal" onClick={(event) => event.stopPropagation()}>
            <div className="chat-modal-header">
              <h3>Редактировать название группы</h3>
              <button type="button" className="chat-modal-close" onClick={() => setShowRenameGroupModal(false)}>×</button>
            </div>

            <input
              type="text"
              value={renameGroupName}
              onChange={(event) => setRenameGroupName(event.target.value)}
              placeholder="Название группы"
              maxLength={100}
              style={{ width: '100%', marginBottom: '16px', borderRadius: '12px', border: '1px solid var(--border)', padding: '12px', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-primary)' }}
            />

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="chat-attach-button" onClick={() => setShowRenameGroupModal(false)}>
                Отменить
              </button>
              <button
                type="button"
                className="chat-send-button"
                onClick={handleSaveGroupRename}
                disabled={!renameGroupName.trim() || renameGroupName.trim() === activeGroup.name}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveGroupConfirm && activeGroup && (
        <div className="chat-modal-backdrop" onClick={() => setShowLeaveGroupConfirm(false)}>
          <div className="chat-modal" onClick={(event) => event.stopPropagation()}>
            <div className="chat-modal-header">
              <h3>Выйти из группы?</h3>
              <button type="button" className="chat-modal-close" onClick={() => setShowLeaveGroupConfirm(false)}>×</button>
            </div>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Вы точно хотите выйти из этой группы?
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="chat-attach-button" onClick={() => setShowLeaveGroupConfirm(false)}>
                Остаться
              </button>
              <button type="button" className="chat-send-button" onClick={confirmLeaveGroup}>
                Да
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}