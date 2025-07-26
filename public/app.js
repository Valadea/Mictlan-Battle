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

            if (!response.ok) {
                throw new Error('投票失败');
            }

            const updatedBattle = await response.json();
            
            // --- 更新前端界面 ---
            const battleElement = document.getElementById(`battle-${battleId}`);
            if (battleElement) {
                 battleElement.querySelector('.option:nth-child(1) .votes').textContent = `票数: ${updatedBattle.option1.votes}`;
                 battleElement.querySelector('.option:nth-child(3) .votes').textContent = `票数: ${updatedBattle.option2.votes}`;
                 const resultsDiv = battleElement.querySelector('.results');
                 resultsDiv.innerHTML = `<p class="winner">胜者是: ${updatedBattle.winner}</p>`;
            }

        } catch (error) {
            console.error('投票请求失败:', error);
            alert('投票失败，请刷新页面重试。');
        }
    };


    // --- 页面加载时，立即加载对战 ---
    loadBattles();
});