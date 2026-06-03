export function evaluate(condition, snapshot) {
    if ('and' in condition) {
        return condition.and.every(c => evaluate(c, snapshot));
    }
    if ('or' in condition) {
        return condition.or.some(c => evaluate(c, snapshot));
    }
    if ('not' in condition) {
        return !evaluate(condition.not, snapshot);
    }

    const dotIdx = condition.var.indexOf('.');
    const scope = condition.var.slice(0, dotIdx);
    const name = condition.var.slice(dotIdx + 1);
    const val = scope === 'local' ? snapshot.local[name] : snapshot.global[name];

    switch (condition.op) {
        case 'eq':  return val === condition.value;
        case 'neq': return val !== condition.value;
        case 'gt':  return val !== undefined && val > condition.value;
        case 'gte': return val !== undefined && val >= condition.value;
        case 'lt':  return val !== undefined && val < condition.value;
        case 'lte': return val !== undefined && val <= condition.value;
        case 'in':  return val !== undefined && Array.isArray(condition.value) && condition.value.includes(val);
        default:    return false;
    }
}
