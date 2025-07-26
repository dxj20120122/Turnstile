(function() {
    // 安全配置
    const SECURITY = {
        ALLOWED_ORIGINS: ['https://y.cvii.dpdns.org'],
        TOKEN_EXPIRY: 300000, // 5分钟
        MAX_ATTEMPTS: 3,
        ENCRYPTION_KEY: 'secure_key_' + Math.random().toString(36).substring(2, 15)
    };

    // 创建覆盖层
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
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
    iframe.src = 'https://y.cvii.dpdns.org/turnstile.html?host=' + 
                 encodeURIComponent(window.location.host) + 
                 '&ref=' + encodeURIComponent(document.referrer);
    iframe.style.border = 'none';
    iframe.style.width = '320px';
    iframe.style.height = '550px';
    iframe.style.borderRadius = '8px';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
    
    container.appendChild(iframe);
    document.body.appendChild(container);
    
    // 会话数据
    const sessionData = {
        token: generateSecureToken(),
        createdAt: Date.now(),
        attempts: 0,
        verified: false,
        callbacks: {
            onSuccess: null,
            onError: null,
            onShow: null,
            onHide: null
        }
    };
    
    // 显示/隐藏方法
    function showTurnstile() {
        overlay.style.display = 'block';
        container.style.display = 'block';
        document.body.style.overflow = 'hidden';
        triggerCallback('onShow');
    }
    
    function hideTurnstile() {
        overlay.style.display = 'none';
        container.style.display = 'none';
        document.body.style.overflow = 'auto';
        triggerCallback('onHide');
    }
    
    // 安全的消息监听器
    window.addEventListener('message', function(e) {
        if (!e.data || typeof e.data !== 'object' || e.data.type !== 'turnstileVerified') return;
        
        // 安全验证
        if (!isValidOrigin(e.origin) || !verifyToken(e.data.token) || 
            isTimestampExpired(e.data.timestamp) || !verifySignature(e.data)) {
            console.warn('Security check failed for message:', e.data);
            return;
        }
        
        // 处理验证结果
        if (e.data.success) {
            handleVerificationSuccess(e.data);
        } else {
            handleVerificationError(e.data);
        }
    });
    
    // 验证成功处理
    function handleVerificationSuccess(data) {
        sessionData.verified = true;
        hideTurnstile();
        
        // 触发成功回调
        if (typeof sessionData.callbacks.onSuccess === 'function') {
            sessionData.callbacks.onSuccess({
                sessionId: data.sessionId,
                timestamp: data.timestamp,
                host: data.host
            });
        }
        
        // 触发全局事件
        document.dispatchEvent(new CustomEvent('turnstile.success', {
            detail: data
        }));
    }
    
    // 验证失败处理
    function handleVerificationError(data) {
        sessionData.attempts++;
        
        // 触发失败回调
        if (typeof sessionData.callbacks.onError === 'function') {
            sessionData.callbacks.onError({
                error: data.error,
                attempts: sessionData.attempts,
                maxAttempts: SECURITY.MAX_ATTEMPTS
            });
        }
        
        // 触发全局事件
        document.dispatchEvent(new CustomEvent('turnstile.error', {
            detail: data
        }));
        
        // 超过最大尝试次数重新加载
        if (sessionData.attempts >= SECURITY.MAX_ATTEMPTS) {
            setTimeout(() => location.reload(), 2000);
        }
    }
    
    // 触发回调
    function triggerCallback(type) {
        if (typeof sessionData.callbacks[type] === 'function') {
            sessionData.callbacks[type]();
        }
    }
    
    // 安全辅助函数
    function generateSecureToken() {
        const randomPart = Math.random().toString(36).substring(2, 15) + 
                          Math.random().toString(36).substring(2, 15);
        const timePart = Date.now().toString(36);
        return btoa(encodeURIComponent(randomPart + timePart + SECURITY.ENCRYPTION_KEY));
    }
    
    function isValidOrigin(origin) {
        try {
            const originUrl = new URL(origin);
            return SECURITY.ALLOWED_ORIGINS.includes(originUrl.origin);
        } catch (e) {
            return false;
        }
    }
    
    function verifyToken(token) {
        return token === sessionData.token && 
               (Date.now() - sessionData.createdAt) < SECURITY.TOKEN_EXPIRY;
    }
    
    function isTimestampExpired(timestamp) {
        return Date.now() - timestamp > 30000; // 30秒过期
    }
    
    function verifySignature(data) {
        const checkStr = data.type + data.token + data.timestamp;
        return data.signature === btoa(encodeURIComponent(checkStr + SECURITY.ENCRYPTION_KEY));
    }
    
    // 自动显示验证
    showTurnstile();
    
    // 暴露API
    window.Turnstile = {
        // 控制方法
        show: showTurnstile,
        hide: hideTurnstile,
        reset: function() {
            location.reload();
        },
        
        // 状态检查
        getStatus: function() {
            return {
                verified: sessionData.verified,
                attempts: sessionData.attempts,
                maxAttempts: SECURITY.MAX_ATTEMPTS
            };
        },
        
        // 回调设置
        onSuccess: function(callback) {
            sessionData.callbacks.onSuccess = callback;
        },
        onError: function(callback) {
            sessionData.callbacks.onError = callback;
        },
        onShow: function(callback) {
            sessionData.callbacks.onShow = callback;
        },
        onHide: function(callback) {
            sessionData.callbacks.onHide = callback;
        },
        
        // 事件监听兼容模式
        listen: function(event, callback) {
            if (event === 'success') {
                document.addEventListener('turnstile.success', function(e) {
                    callback(e.detail);
                });
            } else if (event === 'error') {
                document.addEventListener('turnstile.error', function(e) {
                    callback(e.detail);
                });
            }
        }
    };
    
    // 自动初始化事件系统
    document.dispatchEvent(new CustomEvent('turnstile.ready'));
})();