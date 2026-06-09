const baseSwaggerSpec = require('./swaggerSpec');

function cloneSpec(spec) {
    return JSON.parse(JSON.stringify(spec));
}

function buildSwaggerSpec({
    title,
    description,
    servers,
    pathFilter,
}) {
    const spec = cloneSpec(baseSwaggerSpec);

    if (title) {
        spec.info.title = title;
    }

    if (description) {
        spec.info.description = description;
    }

    if (servers) {
        spec.servers = servers;
    }

    if (typeof pathFilter === 'function') {
        spec.paths = Object.fromEntries(
            Object.entries(spec.paths || {}).filter(([routePath]) => pathFilter(routePath))
        );
    }

    return spec;
}

function createSwaggerUiHtml({ title, specUrl }) {
    const escapedTitle = String(title || 'Swagger UI').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedTitle}</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        background: #f5f7fb;
      }

      #swagger-ui {
        min-height: 100vh;
      }

      .swagger-ui .topbar {
        display: none;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: ${JSON.stringify(specUrl)},
          dom_id: '#swagger-ui',
          deepLinking: true,
          displayRequestDuration: true,
          persistAuthorization: false,
          layout: 'BaseLayout',
          presets: [SwaggerUIBundle.presets.apis],
          syntaxHighlight: { activated: true },
        });
      };
    </script>
  </body>
</html>`;
}

function mountSwaggerDocs(app, { mountPath, spec, title }) {
    const specPath = `${mountPath.replace(/\/$/, '')}/openapi.json`;

    app.get(mountPath, (req, res) => {
        res.type('html').send(createSwaggerUiHtml({ title, specUrl: specPath }));
    });

    app.get(specPath, (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(spec);
    });
}

module.exports = {
    buildSwaggerSpec,
    mountSwaggerDocs,
};