import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

export default function Stats() {
  const [streak, setStreak] = useState(0);
  const [streakText, setStreakText] = useState('дней подряд');
  const [learnedWords, setLearnedWords] = useState(0);
  const [studyTime, setStudyTime] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [activity, setActivity] = useState({});
  const [calendarHtml, setCalendarHtml] = useState('');
  const [monthLabelsHtml, setMonthLabelsHtml] = useState('');
  const resizeTimeoutRef = useRef(null);

  const loadStatsFromServer = useCallback(async () => {
    try {
      const stats = await api.getStats();
      // Обновляем AppState данными сервера
      if (window.AppState) {
        window.AppState.user.streak = stats.streak || 0;
        window.AppState.user.learnedWords = stats.learned_words || 0;
        window.AppState.user.studyTime = stats.study_time || 0;
        window.AppState.user.accuracy = stats.accuracy || 0;
        window.AppState.user.lastStudyDate = stats.last_study_date;
      }

      // Загружаем активность с сервера
      try {
        const activityData = await api.getActivity();
        // Всегда устанавливаем активность (может быть пустым объектом)
        if (activityData && activityData.activity) {
          // Сливаем серверную активность с локальной (локальная имеет приоритет)
          if (window.AppState) {
            window.AppState.user.activity = { ...activityData.activity, ...window.AppState.user.activity };
          }
        }
      } catch (e) {
        console.error('Failed to load activity:', e);
      }

      // Рассчитываем текущую серию по активности
      if (window.AppState && window.AppState.user.activity) {
        const act = window.AppState.user.activity;
        let streakCount = 0;
        let offset = 0;
        
        const pad = n => String(n).padStart(2, '0');
        const toDateStr = (dObj) => `${dObj.getFullYear()}-${pad(dObj.getMonth()+1)}-${pad(dObj.getDate())}`;

        // Сначала проверяем сегодняшнюю дату
        let d = new Date();
        let todayStr = toDateStr(d);
        
        if (!act[todayStr] || act[todayStr] <= 0) {
            offset = 1; // начинаем с вчерашнего дня
        }

        while (true) {
            let checkDate = new Date();
            checkDate.setDate(checkDate.getDate() - offset);
            let checkStr = toDateStr(checkDate);
            
            if (act[checkStr] && act[checkStr] > 0) {
                streakCount++;
                offset++;
            } else {
                break;
            }
        }
        
        window.AppState.user.streak = streakCount;
      }

      // Обновляем локальное отображение
      updateStatsDisplay();
      renderActivityCalendar();
    } catch (error) {
      console.error('Failed to load stats from server:', error);
      // Используем локальные данные при ошибке
      updateStatsDisplay();
    }
  }, []);

  const saveStatsToServer = useCallback(async () => {
    try {
      await api.updateStats({
        streak: window.AppState?.user?.streak || 0,
        learned_words: window.AppState?.user?.learnedWords || 0,
        study_time: window.AppState?.user?.studyTime || 0,
        accuracy: window.AppState?.user?.accuracy || 0,
        last_study_date: window.AppState?.user?.lastStudyDate
      });
    } catch (error) {
      console.error('Failed to save stats to server:', error);
    }
  }, []);

  // Глобальные функции
  window.refreshStats = () => {
    loadStatsFromServer();
  };

  window.saveStats = () => {
    saveStatsToServer();
  };

  const updateStatsDisplay = useCallback(() => {
    const currentStreak = window.AppState?.user?.streak || 0;
    setStreak(currentStreak);

    let newStreakText = 'дней подряд';
    if (currentStreak % 10 === 1 && currentStreak % 100 !== 11) {
      newStreakText = 'день подряд';
    } else if (currentStreak % 10 >= 2 && currentStreak % 10 <= 4 && (currentStreak % 100 < 10 || currentStreak % 100 >= 20)) {
      newStreakText = 'дня подряд';
    }
    setStreakText(newStreakText);

    const currentLearnedWords = window.AppState?.user?.learnedWords || 0;
    setLearnedWords(currentLearnedWords);

    // Используем реальное время занятий (в минутах)
    const currentStudyTime = window.AppState?.user?.studyTime ? Math.floor(window.AppState.user.studyTime / 60) : 0;
    setStudyTime(currentStudyTime);

    const currentAccuracy = (currentLearnedWords > 0) ?
      Math.min(95, 70 + Math.floor(currentStreak * 0.5)) : 0;
    setAccuracy(currentAccuracy);
  }, []);

  const renderActivityCalendar = useCallback(() => {
    // Проверяем мобильное устройство
    const isMobile = window.innerWidth <= 600;

    // На ПК: 7x54 = 378 дней (полный год)
    // На мобильном: 7x27 = 189 дней (полгода)
    const weeks = isMobile ? 27 : 54;
    const gridCols = `repeat(${weeks}, minmax(${isMobile ? '4px' : '4px'}, 1fr))`;
    const daysInWeek = 7;
    const totalDays = weeks * daysInWeek;

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);

    // Генерируем подписи месяцев
    const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const monthLabelsArray = new Array(weeks).fill('');

    for (let week = 0; week < weeks; week++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + (week * 7) + 3);

      const month = date.getMonth();
      const monthName = monthNames[month];

      if (week === 0) {
        monthLabelsArray[week] = monthName;
      } else {
        const prevDate = new Date(startDate);
        prevDate.setDate(prevDate.getDate() + ((week - 1) * 7) + 3);
        const prevMonth = prevDate.getMonth();

        if (month !== prevMonth) {
          monthLabelsArray[week] = monthName;
        }
      }
    }

    let monthsHtml = '';
    for (let i = 0; i < monthLabelsArray.length; i++) {
      monthsHtml += '<div class="month-label">' + monthLabelsArray[i] + '</div>';
    }
    setMonthLabelsHtml(monthsHtml);

    const activity = window.AppState?.user?.activity || {};
    const daySquares = [];

    // В стиле GitHub: сначала дни недели (строки), потом недели (колонки)
    for (let dayOfWeek = 0; dayOfWeek < daysInWeek; dayOfWeek++) {
      for (let week = 0; week < weeks; week++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + (week * 7) + dayOfWeek);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        // Проверяем: если значение существует и больше 0 - день активный
        const isActive = activity && activity[dateStr] && activity[dateStr] > 0;

        daySquares.push(`<div class="day-square${isActive ? ' active' : ''}" title="${dateStr}"></div>`);
      }
    }

    const calendarGridHtml = daySquares.join('');
    setCalendarHtml(calendarGridHtml);
  }, []);

  // Обновление статистики раз в секунду
  useEffect(() => {
    const interval = setInterval(() => {
      updateStatsDisplay();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [updateStatsDisplay]);

  // Перерисовка календаря при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => {
        renderActivityCalendar();
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeoutRef.current);
    };
  }, [renderActivityCalendar]);

  // Загрузка данных при монтировании и обновление календаря
  useEffect(() => {
    loadStatsFromServer();

    // Регистрируем глобальную init-функцию
    window.initStatsPage = () => {
      loadStatsFromServer();
      updateStatsDisplay();
      renderActivityCalendar();
    };
  }, [loadStatsFromServer]);

  useEffect(() => {
    updateStatsDisplay();
  }, []);

  useEffect(() => {
    renderActivityCalendar();
  }, []);

  return (
    <div className="stats-page">
      <h1>Статистика</h1>

      {/* Streak */}
      <div className="streak-box">
        <div className="streak-icon">
          <span className="fire-emoji">🔥</span>
        </div>
        <div>
          <div className="streak-value">{streak}</div>
          <div className="streak-label">{streakText}</div>
        </div>
      </div>

      {/* Основные показатели */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{learnedWords}</div>
          <div className="stat-label">выучено слов</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{studyTime}</div>
          <div className="stat-label">минут занятий</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{accuracy}%</div>
          <div className="stat-label">точность</div>
        </div>
      </div>

      {/* Активность с подписями как на GitHub */}
      <h2>Активность</h2>
      <div className="activity-calendar-container">
        <div className="calendar-wrapper">
          {/* Подписи дней недели слева */}
          <div className="weekdays">
            <div className="weekday-label">Пн</div>
            <div className="weekday-label">Ср</div>
            <div className="weekday-label">Пт</div>
          </div>

          {/* Календарь с месяцами */}
          <div className="calendar-grid">
            {/* Подписи месяцев */}
            <div 
              className="month-labels" 
              id="monthLabels"
              dangerouslySetInnerHTML={{ __html: monthLabelsHtml }}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${window.innerWidth <= 600 ? 27 : 54}, minmax(4px, 1fr))`,
                gap: window.innerWidth <= 600 ? '1px' : '2px',
                width: '100%'
              }}
            />
            {/* Сетка активности */}
            <div 
              className="activity-calendar" 
              id="activityCalendar"
              dangerouslySetInnerHTML={{ __html: calendarHtml }}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${window.innerWidth <= 600 ? 27 : 54}, minmax(4px, 1fr))`,
                gridTemplateRows: window.innerWidth <= 600 ? 'repeat(7, 1fr)' : 'repeat(7, minmax(12px, auto))',
                gap: window.innerWidth <= 600 ? '1px' : '2px',
                width: '100%'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}