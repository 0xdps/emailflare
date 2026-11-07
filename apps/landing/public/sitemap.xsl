<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="sm">

  <xsl:output method="html" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sitemap — EmailFlare</title>
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0d0d0d;
            color: #e8e2da;
            padding: 48px 24px;
            min-height: 100vh;
          }
          .wrap { max-width: 720px; margin: 0 auto; }
          header { display: flex; align-items: center; gap: 14px; margin-bottom: 36px; }
          .logo {
            width: 40px; height: 40px; border-radius: 10px;
            background: linear-gradient(135deg, #9a3412 0%, #ea580c 55%, #fb923c 100%);
            display: flex; align-items: center; justify-content: center;
          }
          .logo svg { width: 22px; height: 22px; }
          h1 { font-size: 1.25rem; font-weight: 700; color: #f0ebe4; }
          h1 span { font-weight: 400; color: #6b6460; margin-left: 8px; font-size: 0.9rem; }
          table { width: 100%; border-collapse: collapse; }
          thead tr {
            border-bottom: 1px solid #2a2520;
          }
          thead th {
            text-align: left;
            font-size: 10.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b6460;
            padding: 0 16px 12px;
          }
          thead th:first-child { padding-left: 0; }
          tbody tr {
            border-bottom: 1px solid #1e1b18;
            transition: background 0.1s;
          }
          tbody tr:hover { background: #161310; }
          tbody tr:last-child { border-bottom: none; }
          td {
            padding: 13px 16px;
            font-size: 13.5px;
            vertical-align: middle;
          }
          td:first-child { padding-left: 0; }
          a {
            color: #ea580c;
            text-decoration: none;
          }
          a:hover { text-decoration: underline; }
          .pill {
            display: inline-block;
            font-size: 11px;
            background: #1e1b18;
            color: #8a8078;
            border: 1px solid #2a2520;
            border-radius: 100px;
            padding: 2px 9px;
          }
          .priority { font-size: 13px; color: #6b6460; }
          footer { margin-top: 32px; font-size: 12px; color: #3d3830; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <header>
            <div class="logo">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M53 11 L9 28 L23 38 Z" fill="white"/>
                <path d="M53 11 L23 38 L9 53 Z" fill="white" opacity="0.82"/>
              </svg>
            </div>
            <h1>EmailFlare <span>sitemap.xml</span></h1>
          </header>

          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Change freq</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sm:urlset/sm:url">
                <tr>
                  <td>
                    <a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a>
                  </td>
                  <td><span class="pill"><xsl:value-of select="sm:changefreq"/></span></td>
                  <td class="priority"><xsl:value-of select="sm:priority"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>

          <footer>
            <xsl:value-of select="count(sm:urlset/sm:url)"/> URLs indexed
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
