// public/app.js

document.addEventListener('DOMContentLoaded', () => {
    const battlesContainer = document.getElementById('battles-container');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminPanel = document.getElementById('admin-panel');
    const adminPasswordInput = document.getElementById('admin-password-input');

    let isAdminLoggedIn = false;
    let activeTimers = []; // 存储所有活动的计时器ID

    // --- 函数：格式化剩余时间 ---
    const formatTimeLeft = (ms) => {
        if (ms < 0) return "已截止";
        let seconds = Math.floor(ms / 1000);
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);
        let days = Math.floor(hours / 24);

        hours %= 24;
        minutes %= 60;
        seconds %= 60;

        return `${days}天 ${hours}小时 ${minutes}分钟 ${seconds}秒`;
    };

    // --- 函数：加载并显示所有对战 ---
    const loadBattles = async () => {
        // 清除旧的计时器
        activeTimers.forEach(timerId => clearInterval(timerId));
        activeTimers = [];

        try {
            const response = await fetch('/api/battles');
            const battles = await response.json();
            
            battlesContainer.innerHTML = '';

            if (battles.length === 0) {
                battlesContainer.innerHTML = '<p>暂无对战，请管理员创建。</p>';
                return;
            }

            battles.forEach(battle => {
                const battleElement = document.createElement('div');
                battleElement.classList.add('battle');
                battleElement.setAttribute('id', `battle-${battle.id}`);
                
                const now = new Date();
                const deadline = new Date(battle.deadline);
                const isExpired = now > deadline;

                let resultDisplay = '';
                if (isExpired) {
                    resultDisplay = `<p class="winner">最终胜者是: ${battle.winner || '平局'}</p>`;
                } else {
                    resultDisplay = `<div class="countdown" id="timer-${battle.id}">计算剩余时间...</div>`;
                }

                battleElement.innerHTML = `
                    ${isAdminLoggedIn ? `<button class="remove-btn" onclick="removeBattle(${battle.id})">❌ 移除对战</button>` : ''}
                    <div class="battle-options">
                        <div class="option">
                            <h3>${battle.option1.name}</h3>
                            <img src="${battle.option1.image}" alt="${battle.option1.name}">
                            <button onclick="vote(${battle.id}, 'option1')" ${isExpired ? 'disabled' : ''}>投一票</button>
                            <p class="votes">票数: ${battle.option1.votes}</p>
                        </div>
                        <div class="vs">VS</div>
                        <div class="option">
                            <h3>${battle.option2.name}</h3>
                            <img src="${battle.option2.image}" alt="${battle.option2.name}">
                            <button onclick="vote(${battle.id}, 'option2')" ${isExpired ? 'disabled' : ''}>投一票</button>
                            <p class="votes">票数: ${battle.option2.votes}</p>
                        </div>
                    </div>
                    <div class="results">
                        ${resultDisplay}
                    </div>
                `;
                battlesContainer.appendChild(battleElement);

                // 如果未截止，启动倒计时
                if (!isExpired) {
                    const timerElement = document.getElementById(`timer-${battle.id}`);
                    const timerId = setInterval(() => {
                        const timeLeft = deadline - new Date();
                        timerElement.innerHTML = `剩余时间: ${formatTimeLeft(timeLeft)}`;
                        if (timeLeft < 0) {
                            clearInterval(timerId);
                            // 时间到了，重新加载所有对战以显示最终结果
                            loadBattles(); 
                        }
                    }, 1000);
                    activeTimers.push(timerId);
                }
            });

        } catch (error) {
            console.error('加载对战失败:', error);
            battlesContainer.innerHTML = '<p>无法加载对战信息，请稍后再试。</p>';
        }
    };

    // --- 函数：处理投票 ---
    window.vote = async (battleId, option) => {
        try {
            const response = await fetch(`/api/battles/${battleId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ option: option }),
            });
            const responseData = await response.json();
            if (!response.ok) throw new Error(responseData.error || '投票失败');
            
            // 投票成功后，只更新票数
            const battleElement = document.getElementById(`battle-${battleId}`);
            if (battleElement) {
                const updatedBattle = await (await fetch('/api/battles')).json();
                const currentBattle = updatedBattle.find(b => b.id === battleId);
                battleElement.querySelector('.option:nth-child(1) .votes').textContent = `票数: ${currentBattle.option1.votes}`;
                battleElement.querySelector('.option:nth-child(3) .votes').textContent = `票数: ${currentBattle.option2.votes}`;
                alert('投票成功！');
            }
        } catch (error) {
            console.error('投票请求失败:', error);
            alert(error.message);
        }
    };

    // --- 函数：移除对战 ---
    window.removeBattle = async (battleId) => {
        const password = prompt("请输入管理员密码以确认删除:");
        if (!password) return;

        try {
            const response = await fetch(`/api/admin/battles/${battleId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminPassword: password })
            });
            const responseData = await response.json();
            if (!response.ok) throw new Error(responseData.error || '删除失败');
            
            alert('对战已移除！');
            loadBattles(); // 刷新列表
        } catch (error) {
            console.error('删除请求失败:', error);
            alert(error.message);
        }
    };

    // --- 管理员登录逻辑 ---
    adminLoginBtn.addEventListener('click', () => {
        const password = prompt("请输入管理员密码:");
        if (password) {
            adminPasswordInput.value = password;
            isAdminLoggedIn = true; // 设置管理员登录状态
            adminPanel.style.display = 'block';
            adminLoginBtn.style.display = 'none';
            loadBattles(); // 重新加载对战以显示管理员控件
        }
    });

    // 页面加载时，立即加载对战
    loadBattles();
});