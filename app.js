import {nanoid} from 'https://unpkg.com/nanoid@3.1.12/nanoid.js';
import db from '/db.js';
// -$2 2020-09-11 coke
// -$2 2020-09-11 fuse tea
// x +$21 to y
Array.from(document.querySelectorAll('[budgeting-app]')).forEach(async function budgetingApp(el) {
    const newBudgetForm = el.querySelector('[budgeting-app_new-budget]');
    const newBudgetFields = el.querySelector('[budgeting-app_new-budget-fields]');
    const newBudgetButton = el.querySelector('[budgeting-app_new-budget-button]');
    const importForm = el.querySelector('[budgeting-app_import-form]');
    const budgetList = el.querySelector('[budgeting-app_budgets]');
    const exportEl = el.querySelector('[name="exportData"]');
    // templates
    const budgetItemTemplate = document.getElementById('budgeting_app_budget_item');
    const budgetEditFormTemplate = document.getElementById('budgeting_app_edit_budget_form');
    const lineItemTemplate = document.getElementById('budgeting_app_line_item');
    const lineItemEditFormTemplate = document.getElementById('budgeting_app_edit_line_item_form');

    const state = await db.collection('budgets', {
        newBudgetFormState: null,
        budgets: [],
        budgetIndex: {},
        version: 2
    }).fetchAll();

    state.budgetIndex = getBudgetIndex(state.budgets);

    // migrations
    if (!state.version || 1 > state.version) {
        state.budgets = state.budgets.map(x => ({ ...x , id: nanoid()}));
        state.version = 1;
        db.collection('budgets').save(state);
    }
    if (!state.version || 2 > state.version) {
        const colors = ['#ff0022', '#00ff22', '#2200ff', '#ff00ff', '#ffff22'];
        state.budgets = state.budgets.map((x, i) => ({ ...x, color: colors[i % colors.length] }));
        state.version = 2;
        db.collection('budgets').save(state);
    }

    if (!state.version || 3 > state.version) {

        state.budgets = state.budgets.map(function updateLineItems(budget) {
          if(!budget.items[0] || budget.items[0].name != 'Opening balance') {
            const openingLineItem = {
              id: getId(),
              name: 'Opening balance',
              amount: budget.amount || budget.remaining,
              action: 'deposit',
              modified: Date.now()
            }
            budget.items = [openingLineItem, ...budget.items];
          }

          budget.items = budget.items.map(function addAction(item) {
            return item.action ? item : { ...item, action: 'withdraw'}
          })

          budget.remaining = calculateBalanceFromItems(budget.items);
          return budget;
        });
        state.version = 3;
        db.collection('budgets').save(state);
    }

    renderExport(state);
    render();

    // New Budget
    newBudgetForm.addEventListener('submit', function handleNewBudget(ev) {
        ev.preventDefault();
        switch (state.newBudgetFormState) {
            case null:
                state.newBudgetFormState = 'creatingNewBudget';
                break;
            case 'creatingNewBudget':
                state.newBudgetFormState = null;
                const id = getId();
                const name = this.elements['name'].value;
                const openingAmount = parseFloat(his.elements['amount'].value);
                const color = this.elements['color'].value;
                const modified = Date.now();
                const openingLineItem = {
                  id: getId(),
                  name: 'Opening balance',
                  amount: openingAmount,
                  action: 'deposit',
                  modified
                }
                state.budgets = [...state.budgets, { id, name, color, modified, remaining: openingAmount, items: [openingLineItem] }];
                break;
        }

        state.budgetIndex = getBudgetIndex(state.budgets);
        renderExport(state);
        db.collection('budgets').save(state);
        render();
    })

    // New Budget item
    delegate(el, '[budgeting-app_new-budget-item-form]', 'submit', function handleNewBudgetItem(ev) {
        ev.preventDefault();
        const budgetId = this.elements['budgetId'].value;
        const budget = state.budgetIndex[budgetId];

        switch (budget.addingItem) {
            case undefined:
            case false:
                budget.addingItem = true;
                break;
            case true:
                const id = getId();
                const name = this.elements['name'].value;
                const amount = parseFloat(this.elements['amount'].value);
                const action = this.elements['action'].value;

                if(amount || name.trim()) {
                  const item = { id, name, action, amount, modified: Date.now() };
                  budget.items = [...budget.items, item];
                  budget.remaining = calculateBalanceFromItem(budget.remaining, item);
                }
                budget.addingItem = false;
                break;
        }
        renderExport(state);
        db.collection('budgets').save(state);
        const budgetItem = this.closest('[budgeting-app_budget-item]');
        renderBudget(budgetItem, budget);
    });



    function getBudgetIndex(budgets) {
        const budgetIndex = {};
        for(let budget of budgets) {
            budgetIndex[budget.id] = budget;
        }
        return budgetIndex;
    }

    delegate(el, '[budgeting-app_budget-item]', 'dblclick', function handleBudgetEdit(ev) {
        editBudget(this);
    });
    delegate(el, '[budget-item_edit-button]', 'click', function handleBudgetEdit(ev) {
        editBudget(this.closest('[budgeting-app_budget-item]'));
    });

    function editBudget(budgetItem) {
        const budgetForm = budgetEditFormTemplate.content.cloneNode(true).firstElementChild;

        const budgetId = budgetItem.querySelector('[name="budgetId"]').value;
        const budget = state.budgetIndex[budgetId];

        // render
        budgetForm.elements['name'].value = budget.name;
        budgetForm.elements['color'].value = budget.color;

        let budgetDisplay = document.createDocumentFragment();
        budgetDisplay.append(...budgetItem.cloneNode(true).childNodes);
        emptyEl(budgetItem)

        budgetItem.append(budgetForm);

        budgetForm.addEventListener('submit', function saveBudget(ev) {
            ev.preventDefault();
            emptyEl(budgetItem)
            budget.name = this.elements['name'].value;
            budget.color = this.elements['color'].value;
            budget.modified = Date.now();
            db.collection('budgets').save(state);
            // render
            budgetItem.append(budgetDisplay);
            budgetItem.querySelector('[budget-name]').innerText = budget.name;
            budgetItem.querySelector('[budget-header]').style.setProperty("--color-bg", budget.color);
            renderExport(state);
        });
    }


    delegate(el, '[line-item_edit-button]', 'click', function handleItemsUpdate(ev) {
       // TODO get working with new layout
        ev.preventDefault();
        const budgetEl = this.closest('[budgeting-app_budget-item]');
        const budgetId = budgetEl.dataset.id;
        const budget = state.budgetIndex[budgetId];
        const lineItemEl = this.closest('[budgeting-app_line-item]');
        const itemId = lineItemEl.dataset.id;
        const lineItem = budget.items.find(x => x.id == itemId);
        const lineItemForm = lineItemEditFormTemplate.content.cloneNode(true).firstElementChild;

        // render
        lineItemForm.elements['name'].value = lineItem.name;
        lineItemForm.elements['amount'].value = lineItem.amount;
        lineItemForm.elements['action'].value = lineItem.action;
        //TODO action
        emptyEl(lineItemEl)
        lineItemEl.append(lineItemForm);

        lineItemForm.addEventListener('submit', function saveBudget(ev) {
            ev.preventDefault();
            lineItem.name = this.elements['name'].value;
            lineItem.amount = parseFloat(this.elements['amount'].value);
            lineItem.action = this.elements['action'].value;
            lineItem.modified = Date.now();
            budget.remaining = calculateBalanceFromItems(budget.items)
            db.collection('budgets').save(state);
            // render
            renderExport(state);
            renderBudget(budgetEl, budget);
        });
    })

    delegate(el, '[line-item_delete-button]', 'click', function handleLineItemDelete(ev) {
        const budgetEl = this.closest('[budgeting-app_budget-item]');
        const budgetId = budgetEl.dataset.id;
        const itemId = this.closest('[budgeting-app_line-item]').dataset.id;
        const budget = state.budgetIndex[budgetId];
        budget.items = budget.items.filter(x => x.id != itemId);
        budget.remaining = calculateBalanceFromItems(budget.items);
        db.collection('budgets').save(state);
        renderExport(state);
        renderBudget(budgetEl, budget);
    });

    importForm.addEventListener('submit', function handleImport(ev) {
        //TODO update
        ev.preventDefault();
        let rawData;
        try {
            rawData = JSON.parse(this.elements['importData'].value);
        } finally {
            rawData = rawData || [];
        }
        for(let budget of rawData) {
            let existingBudget = false;
            state.budgets.forEach((localBudget, i) => {
                if (budget.name == localBudget.name) {
                    existingBudget = i;
                }
            });

            if(existingBudget !== false) {
                budget.items.forEach((item, i) => {
                    let existingItem = false;
                    state.budgets[existingBudget].items.forEach((localItem, v) => {
                        if (i === v && localItem.name == item.name) {
                            existingItem = i;
                        }
                    });

                    if(existingItem !== false) {
                        state.budgets[existingBudget].items[existingItem].amount = item.modified > budget.items[existingItem].modified ?
                            item.amount :
                            budget.items[existingItem].amount;
                    } else {
                        state.budgets[existingBudget].items.push(item);
                    }
                });
            } else {
                state.budgets.push(budget);
            }
        }
        state.budgetIndex = getBudgetIndex(state.budgets);
        renderExport(state);
        db.collection('budgets').save(state);
        render();
    });

    function render() {
        if ('creatingNewBudget' == state.newBudgetFormState) {
            newBudgetFields.classList.toggle('hidden', false);
            newBudgetButton.innerText = 'Save Budget';
        } else {
            newBudgetFields.classList.toggle('hidden', true);
            newBudgetButton.innerText = 'New Budget';
        }
        emptyEl(budgetList)
        state.budgets.forEach(function addBudget(budget) {
            const budgetItem = budgetItemTemplate.content.cloneNode(true).firstElementChild;

            renderBudget(budgetItem, budget);
            budgetList.appendChild(budgetItem);
        })

    }

    function renderBudget(budgetItem, budget) {
        budgetItem.dataset.id = budget.id;
        budgetItem.querySelector('[budget-name]').innerText = budget.name;
        budgetItem.querySelector('[budget-remaining]').innerText = round2dp(budget.remaining);
        budgetItem.querySelector('[budget-header]').style.setProperty("--color-bg", budget.color);
        budgetItem.querySelector('[name="budgetId"]').value = budget.id;
        const newItemFields = budgetItem.querySelector('[budgeting-app_new-line-item-fields]');
        const newItemButton = budgetItem.querySelector('[budgeting-app_new-item-button]');
        if (budget.addingItem) {
            newItemFields.classList.toggle('hidden', false);
            newItemButton.innerText = 'Save Item';
        } else {
            newItemFields.classList.toggle('hidden', true);
            newItemButton.innerText = 'New Item';
        }

        const list = budgetItem.querySelector('[budget-app_line-item-list]');
        emptyEl(list)
        const itemtemplate = lineItemTemplate.content.cloneNode(true).firstElementChild;
        [...budget.items].reverse().forEach(function addLineItem(item) {
            const itemEl = itemtemplate.cloneNode(true);
            renderLineItem(itemEl, item);
            list.appendChild(itemEl);
        });
        budgetItem.querySelector('[budget-remaining]').innerText = round2dp(budget.remaining);
    }

    function renderExport(state) {
        exportEl.value = JSON.stringify(state.budgets, null, ' ');
    }
})

function renderLineItem(itemEl, item) {

    itemEl.classList.toggle('line-item--deposit', 'deposit' == item.action);
    itemEl.dataset.id = item.id;
    itemEl.querySelector('[name="action"]').innerText = 'withdraw' == item.action ? '-' : '+';
    itemEl.querySelector('[name="action"]').value = item.action;
    itemEl.querySelector('[name="name"]').innerText = item.name;
    itemEl.querySelector('[name="amount"]').value = item.amount;
    itemEl.querySelector('[name="amount"]').innerText = round2dp(item.amount).toFixed(2);
    return itemEl;
}

function getId() {
    return nanoid();
}
function calculateBalanceFromItems(items) {
  return items.reduce(calculateBalanceFromItem, 0);
}
function calculateBalanceFromItem(acc, item) {
  switch (item.action) {
    case 'deposit':
        acc += item.amount;
      break;
    case 'withdraw':
        acc -= item.amount;
      break;
  }
  return acc;
}
function emptyEl(el) {
  Array.from(el.childNodes).forEach(x => x.remove());
}
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
