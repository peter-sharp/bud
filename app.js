import db from '/db.js';

Array.from(document.querySelectorAll('[budgeting-app]')).forEach(async function budgetingApp(el) {
    const newBudgetForm = el.querySelector('[budgeting-app_new-budget]');
    const newBudgetFields = el.querySelector('[budgeting-app_new-budget-fields]');
    const newBudgetButton = el.querySelector('[budgeting-app_new-budget-button]');
    const budgetList = el.querySelector('[budgeting-app_budgets]');
    const budgetItemTemplate = document.getElementById('budgeting_app_budget_item');
    const state = await db.collection('budgets', {
        state: null,
        budgets: []
    }).fetchAll();
    render();

    newBudgetForm.addEventListener('submit', function handleNewBudget(ev) {
        ev.preventDefault();
        switch (state.state) {
            case null:
                state.state = 'creatingNewBudget';
                break;
            case 'creatingNewBudget':
                state.state = null;
                const id = getId();
                const name = this.elements['name'].value;
                const amount = this.elements['amount'].value;
                const remaining = amount;
                state.budgets.push({ id, name, amount, remaining, items: [] })
                break;
        }
        db.collection('budgets').save(state);
        render();
    })

    delegate(el, '[budget-items-form]', 'submit', function handleItemsUpdate(ev) {
        ev.preventDefault();
        const budgetId = this.elements['budgetId'].value;
        const items = [];
        const nameInputs = this.elements['name'].length !== undefined ? Array.from(this.elements['name']) : [this.elements['name']];
        const amountInputs = this.elements['amount'].length !== undefined ? Array.from(this.elements['amount']) : [this.elements['amount']];
        let total = 0;
        nameInputs.forEach(function makeItem(input, i) {
            const name = input.value;
            const amount = amountInputs[i].value;
            if(name) {
                total += parseFloat(amount);
                items.push({name, amount});
            }
        });
        let budget;
        for(budget of state.budgets) {
            if(budget.id != budgetId) continue;
            budget.items = items;
            budget.remaining = budget.amount - total;
            break;
        }
        db.collection('budgets').save(state);
        const budgetItem = this.closest('[budgeting-app_budget-item]');
        renderBudget(budgetItem, budget);
    })

    function render() {
        if ('creatingNewBudget' == state.state) {
            newBudgetFields.classList.toggle('hidden', false);
            newBudgetButton.innerText = 'Save Budget';
        } else {
            newBudgetFields.classList.toggle('hidden', true);
            newBudgetButton.innerText = 'New Budget';
        }
        Array.from(budgetList.children).forEach(x => x.remove());
        state.budgets.forEach(function addBudget(budget) {
            const budgetItem = budgetItemTemplate.content.cloneNode(true);
            budgetItem.querySelector('[budget-name]').innerText = budget.name;
            budgetItem.querySelector('[budget-amount]').innerText = budget.amount;
            budgetItem.querySelector('[budget-remaining]').innerText = round2dp(budget.remaining);
            budgetItem.querySelector('[name="budgetId"]').value = budget.id;
            renderBudget(budgetItem, budget);
            budgetList.appendChild(budgetItem);
        })
    }

    function renderBudget(budgetItem, budget) {
        const list = budgetItem.querySelector('ul');
        const blankItemEl = list.firstElementChild.cloneNode(true);
        blankItemEl.querySelector('[name="name"]').value = "";
        blankItemEl.querySelector('[name="amount"]').value = "";
        Array.from(list.children).forEach(x => x.remove());
        list.appendChild(blankItemEl);
        budget.items.forEach(function renderItem(item) {
            const itemEl = blankItemEl.cloneNode(true);
            itemEl.querySelector('[name="name"]').value = item.name;
            itemEl.querySelector('[name="amount"]').value = round2dp(item.amount).toFixed(2);
            list.appendChild(itemEl);
        });
        budgetItem.querySelector('[budget-remaining]').innerText = round2dp(budget.remaining);
    }
})

function getId() {
    getId.last += 1;
    localStorage.getItem('lastId', getId.last);
    return getId.last;
}
getId.last = parseFloat(localStorage.getItem('lastId')) || 0;

function delegate(el, selector, evName, cb) {
    el.addEventListener(evName, function onDelegated(ev) {
        const targetEl = ev.target;
        if (targetEl.matches(selector)) {
            cb.call(targetEl, ev);
        }
    })
}

function round2dp(x) {
    return Math.round(x * 100) / 100;
}