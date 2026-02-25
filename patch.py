import sys

with open('client/index.html', 'r') as f:
    content = f.read()

css = """
    /* Loading Overlay Styles */
    #loading-overlay {
      position: fixed;
      inset: 0;
      background: var(--bg-a);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.8s;
      font-family: "Rajdhani", sans-serif;
      color: #83ffd6;
    }

    #loading-overlay.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    .loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      width: 100%;
      max-width: 400px;
      padding: 40px;
      background: rgba(13, 29, 59, 0.7);
      border: 1px solid var(--frame);
      border-radius: 8px;
      box-shadow: 0 0 30px rgba(32, 56, 109, 0.5), inset 0 0 20px rgba(131, 255, 214, 0.05);
      backdrop-filter: blur(10px);
      position: relative;
      overflow: hidden;
    }

    .loading-content::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background: linear-gradient(90deg, transparent, #83ffd6, transparent);
      animation: scanline 2s linear infinite;
    }

    @keyframes scanline {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .loading-logo {
      font-family: "Press Start 2P", monospace;
      font-size: 24px;
      color: #fff;
      text-shadow: 0 0 10px rgba(131, 255, 214, 0.8), 0 0 20px rgba(103, 173, 255, 0.6);
      letter-spacing: 2px;
      margin-bottom: 10px;
      text-align: center;
    }

    .loading-spinner {
      position: relative;
      width: 64px;
      height: 64px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .spinner-ring {
      position: absolute;
      inset: 0;
      border: 3px solid transparent;
      border-top-color: #83ffd6;
      border-right-color: #67adff;
      border-radius: 50%;
      animation: spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
    }

    .spinner-ring::before {
      content: "";
      position: absolute;
      inset: 4px;
      border: 2px solid transparent;
      border-bottom-color: #83ffd6;
      border-left-color: #67adff;
      border-radius: 50%;
      animation: spin 2s linear infinite reverse;
    }

    .spinner-core {
      width: 16px;
      height: 16px;
      background: #83ffd6;
      border-radius: 50%;
      box-shadow: 0 0 15px #83ffd6, 0 0 30px #67adff;
      animation: pulse 2s ease-in-out infinite alternate;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes pulse {
      0% { transform: scale(0.8); opacity: 0.7; }
      100% { transform: scale(1.2); opacity: 1; }
    }

    #loading-status {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      animation: blink 1.5s step-end infinite;
      text-align: center;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .loading-bar-container {
      width: 100%;
      height: 6px;
      background: rgba(32, 56, 109, 0.5);
      border-radius: 3px;
      overflow: hidden;
      position: relative;
    }

    #loading-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #67adff, #83ffd6);
      box-shadow: 0 0 10px #83ffd6;
      transition: width 0.3s ease-out;
    }

    #loading-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      width: 100%;
    }

    .error-text {
      color: #ff4d4d;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: 2px;
      text-shadow: 0 0 10px rgba(255, 77, 77, 0.5);
      text-align: center;
    }

    .retry-button {
      background: transparent;
      border: 1px solid #ff4d4d;
      color: #ff4d4d;
      padding: 10px 24px;
      font-family: "Rajdhani", sans-serif;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: 2px;
      cursor: pointer;
      transition: all 0.2s;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .retry-button:hover {
      background: rgba(255, 77, 77, 0.1);
      box-shadow: 0 0 15px rgba(255, 77, 77, 0.3);
    }

    .retry-button:active {
      transform: scale(0.98);
    }
  </style>
"""

html = """<body>
  <div id="loading-overlay">
    <div class="loading-content">
      <div class="loading-logo">SHOWDOWN</div>
      <div class="loading-spinner" id="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-core"></div>
      </div>
      <div id="loading-status">INITIALIZING SYSTEM...</div>
      <div class="loading-bar-container" id="loading-bar-container">
        <div id="loading-bar"></div>
      </div>
      <div id="loading-error" style="display: none;">
        <div class="error-text">SYSTEM BOOT FAILURE</div>
        <button class="retry-button" onclick="window.location.reload()">REBOOT SYSTEM</button>
      </div>
    </div>
  </div>
"""

content = content.replace('  </style>', css)
content = content.replace('<body>\n', html)

with open('client/index.html', 'w') as f:
    f.write(content)
