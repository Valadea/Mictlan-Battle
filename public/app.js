// public/app.js

document.addEventListener('DOMContentLoaded', () => {
    const battlesContainer = document.getElementById('battles-container');

    // --- 函数：加载并显示所有对战 ---
    const loadBattles = async () => {
        try {
            const response = await fetch('/api/battles');
            const battles = await response.json();
            
            battlesContainer.innerHTML = ''; // 清空现有内容

            if (battles.length === 0) {
                battlesContainer.innerHTML = '<p>暂无对战，请管理员创建。</p>';
                return;
            }

            battles.forEach(battle => {
                const battleElement = document.createElement('div');
                battleElement.classList.add('battle');
                battleElement.setAttribute('id', `battle-${battle.id}`);
                
                battleElement.innerHTML = `
                    <div class="battle-options">
                        <div class="option">
                            <h3>${battle.option1.name}</h3>
                            <img src="${battle.option1.image}" alt="${battle.option1.name}">
                            <button onclick="vote(${battle.id}, 'option1')">投一票</button>
                            <p class="votes">票数: ${battle.option1.votes}</p>
                        </div>
                        <div class="vs">VS</div>
                        <div class="option">
                            <h3>${battle.option2.name}</h3>
                            <img src="${battle.option2.image}" alt="${battle.option2.name}">
                            <button onclick="vote(${battle.id}, 'option2')">投一票</button>
                            <p class="votes">票数: ${battle.option2.votes}</p>
                        </div>
                    </div>
                    <div class="results">
                        ${battle.winner ? `<p class="winner">胜者是: ${battle.winner}</p>` : '<p>正在投票中...</p>'}
                    </div>
                `;
                battlesContainer.appendChild(battleElement);
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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ option: option }),
        });

        const responseData = await response.json();

        // 如果服务器返回错误信息 (比如重复投票)
        if (!response.ok) {
            // responseData.error 是后端返回的 { error: '您已经投过票了！' }
            throw new Error(responseData.error || '投票失败');
        }

        // --- 更新前端界面 ---
        const battleElement = document.getElementById(`battle-${battleId}`);
        if (battleElement) {
             battleElement.querySelector('.option:nth-child(1) .votes').textContent = `票数: ${responseData.option1.votes}`;
             battleElement.querySelector('.option:nth-child(3) .votes').textContent = `票数: ${responseData.option2.votes}`;
             const resultsDiv = battleElement.querySelector('.results');
             resultsDiv.innerHTML = `<p class="winner">胜者是: ${responseData.winner}</p>`;

             // 投票成功后，可以禁用按钮
             battleElement.querySelectorAll('button').forEach(button => {
                 button.disabled = true;
                 button.textContent = "已投票";
             });
        }

        } catch (error) {
           console.error('投票请求失败:', error);
        alert(error.message); // 直接弹出后端返回的错误信息
        }
    };


    // --- 页面加载时，立即加载对战 ---
    loadBattles();
});
document.addEventListener('DOMContentLoaded', () => {
    // ... 你已有的 loadBattles 和 vote 函数 ...

    // --- 新增的管理员登录逻辑 ---
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminPanel = document.getElementById('admin-panel');
    const adminPasswordInput = document.getElementById('admin-password-input');

    adminLoginBtn.addEventListener('click', () => {
        const password = prompt("请输入管理员密码:");
        if (password) {
            // 这个密码将填充到隐藏的输入框中，随表单一起提交到后端进行验证
            adminPasswordInput.value = password;
            // 只是在前端显示面板，真正的安全验证在后端
            adminPanel.style.display = 'block';
            adminLoginBtn.style.display = 'none'; // 登录后隐藏按钮
        }
    });
});