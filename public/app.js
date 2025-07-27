// public/app.js (完整替换)

document.addEventListener('DOMContentLoaded', () => {
    const battlesContainer = document.getElementById('battles-container');
    const eventTitleElement = document.getElementById('event-title'); // 获取标题元素
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminPanel = document.getElementById('admin-panel');
    const adminPasswordInput = document.getElementById('admin-password-input');

    let isAdminLoggedIn = false;
    let activeTimers = [];

    const formatTimeLeft = (ms) => {
        if (ms < 0) return "已截止";
        let seconds = Math.floor(ms / 1000);
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);
        let days = Math.floor(hours / 24);
        hours %= 24; minutes %= 60; seconds %= 60;
        return `${days}天 ${hours}小时 ${minutes}分钟 ${seconds}秒`;
    };

    const loadBattles = async () => {
    // ... 前面代码不变 ...
    try {
        // ...
        battles.forEach(battle => {
            const battleElement = document.createElement('div');
            battleElement.classList.add('battle');
            battleElement.setAttribute('id', `battle-${battle.id}`);
            
            const now = new Date();
            // ================== 修改开始 ==================
            // 确保 battle.deadline 存在且有效，否则认为它未过期
            const deadline = battle.deadline ? new Date(battle.deadline) : null;
            const isExpired = deadline ? now > deadline : false; 
            // ================== 修改结束 ==================

            let resultDisplay = isExpired ? `<p class="winner">最终胜者是: ${battle.winner || '平局'}</p>` : `<div class="countdown" id="timer-${battle.id}">计算剩余时间...</div>`;

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
                <div class="results">${resultDisplay}</div>
            `;
            battlesContainer.appendChild(battleElement);

            // 如果未过期且 deadline 有效
            if (!isExpired && deadline) {
                const timerElement = document.getElementById(`timer-${battle.id}`);
                const timerId = setInterval(() => {
                    const timeLeft = deadline - new Date();
                    timerElement.innerHTML = `剩余时间: ${formatTimeLeft(timeLeft)}`;
                    if (timeLeft < 0) {
                        clearInterval(timerId);
                        loadBattles(); 
                    }
                }, 1000);
                activeTimers.push(timerId);
            }
        });
        } catch (error) {
            console.error('加载数据失败:', error);
            battlesContainer.innerHTML = '<p>无法加载数据，请稍后再试。</p>';
        }
    };

    window.vote = async (battleId, option) => {
        try {
            const response = await fetch(`/api/battles/${battleId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ option: option }),
            });
            const responseData = await response.json();
            if (!response.ok) throw new Error(responseData.error || '投票失败');
            
            const data = await (await fetch('/api/data')).json();
            const currentBattle = data.battles.find(b => b.id === battleId);
            const battleElement = document.getElementById(`battle-${battleId}`);
            if (battleElement && currentBattle) {
                battleElement.querySelector('.option:nth-child(1) .votes').textContent = `票数: ${currentBattle.option1.votes}`;
                battleElement.querySelector('.option:nth-child(3) .votes').textContent = `票数: ${currentBattle.option2.votes}`;
            }
            alert('投票成功！');
        } catch (error) {
            console.error('投票请求失败:', error);
            alert(error.message);
        }
    };

    // 新增：更新活动标题的函数
    window.updateEventTitle = async () => {
        const newTitle = document.getElementById('new-title-input').value;
        if (!newTitle) {
            alert('标题不能为空！');
            return;
        }
        const password = prompt("请输入管理员密码以确认修改:");
        if (!password) return;

        try {
            const response = await fetch('/api/admin/event-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminPassword: password, newTitle: newTitle })
            });
            const responseData = await response.json();
            if (!response.ok) throw new Error(responseData.error || '更新失败');
            
            alert('标题更新成功！');
            eventTitleElement.textContent = responseData.newTitle;
        } catch (error) {
            console.error('更新标题失败:', error);
            alert(error.message);
        }
    };

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
            loadBattles();
        } catch (error) {
            console.error('删除请求失败:', error);
            alert(error.message);
        }
    };

    adminLoginBtn.addEventListener('click', () => {
        const password = prompt("请输入管理员密码:");
        if (password) {
            adminPasswordInput.value = password;
            isAdminLoggedIn = true;
            adminPanel.style.display = 'block';
            adminLoginBtn.style.display = 'none';
            loadBattles();
        }
    });

    loadBattles();
});