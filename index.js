(function() {
    // 配置
    const config = {
        allowedOrigins: [
            '*'
        ],
        iframeSrc: 'https://cvii.dpdns.org/turnstile.html',
        verificationTimeout: 300000, // 5分钟验证超时
        tokenExpiry: 3600000 // 1小时token有效期
    };
    
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.99)';
    overlay.style.zIndex = '9998';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
    
    // 创建验证容器
    const container = document.createElement('div');
    container.id = 'turnstile-container';
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.zIndex = '9999';
    container.style.display = 'none';
    
    // 创建iframe
    const iframe = document.createElement('iframe');
    iframe.src = config.iframeSrc;
    iframe.style.border = 'none';
    iframe.style.width = '320px';
    iframe.style.height = '400px';
    iframe.style.borderRadius = '8px';
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms';
    
    container.appendChild(iframe);
    document.body.appendChild(container);
    
    // 验证状态
    let verificationTimer;
    let isVerified = false;
    
    // 显示验证
    function showTurnstile() {
        overlay.style.display = 'block';
        container.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // 设置验证超时
        verificationTimer = setTimeout(() => {
            if (!isVerified) {
                hideTurnstile();
                alert('验证超时，请刷新页面重试');
            }
        }, config.verificationTimeout);
    }
    
    // 隐藏验证
    function hideTurnstile() {
        overlay.style.display = 'none';
        container.style.display = 'none';
        document.body.style.overflow = 'auto';
        clearTimeout(verificationTimer);
    }
    
    // 检查token是否有效
    function isValidToken(token, expiry) {
        if (!token || !expiry) return false;
        
        const now = Date.now();
        const expiryTime = parseInt(expiry);
        
        // 检查token是否过期（提前5分钟视为即将过期）
        return now < (expiryTime - 300000);
    }
    
    // 清除过期token
    function clearExpiredToken() {
        const token = localStorage.getItem('turnstile_token');
        const expiry = localStorage.getItem('turnstile_token_expiry');
        
        if (token && expiry && !isValidToken(token, expiry)) {
            localStorage.removeItem('turnstile_token');
            localStorage.removeItem('turnstile_token_expiry');
        }
    }
    
    // 检查是否有有效token
    function checkExistingToken() {
        clearExpiredToken(); // 先清理过期token
        
        const token = localStorage.getItem('turnstile_token');
        const expiry = localStorage.getItem('turnstile_token_expiry');
        
        return isValidToken(token, expiry);
    }
    
    // 严格的消息监听
    window.addEventListener('message', function(e) {
        // 验证消息结构
        if (e.data && typeof e.data === 'object' && 
            e.data.type === 'turnstileVerified' && 
            typeof e.data.success === 'boolean') {
            
            if (e.data.success) {
                isVerified = true;
                hideTurnstile();
                
                // 存储验证token和过期时间
                if (e.data.token) {
                    localStorage.setItem('turnstile_token', e.data.token);
                    localStorage.setItem('turnstile_token_expiry', Date.now() + config.tokenExpiry);
                }
            }
        }
    });
    
    // 初始化
    if (!checkExistingToken()) {
        showTurnstile();
    }
    
    // 公开API
    window.Turnstile = {
        show: showTurnstile,
        hide: hideTurnstile,
        isVerified: function() {
            return isVerified || checkExistingToken();
        },
        getToken: function() {
            // 返回token前检查有效性
            return checkExistingToken() ? localStorage.getItem('turnstile_token') : null;
        },
        clearToken: function() {
            localStorage.removeItem('turnstile_token');
            localStorage.removeItem('turnstile_token_expiry');
            isVerified = false;
        },
        getTokenExpiry: function() {
            return localStorage.getItem('turnstile_token_expiry');
        }
    };
})();