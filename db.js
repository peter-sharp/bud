const db = {}
function collection (name, fallback = {}) {
    let state;

    try {
        state = JSON.parse(localStorage.getItem(name));
    } finally {
        if(null === state || undefined === state) {
            state = fallback;
        }
    }

    function fetchAll() {
        return Promise.resolve(state);
    }

    function save(updatedState) {
        localStorage.setItem(name, JSON.stringify(updatedState));
        return Promise.resolve(true);
    }

    return {
        fetchAll,
        save
    }
}

db.collection = collection;
export default db