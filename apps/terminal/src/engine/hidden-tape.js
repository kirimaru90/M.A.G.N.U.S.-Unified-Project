function lookupHiddenTape(value, hiddenTapes) {
    if (!value) return null;
    return hiddenTapes.find(t => t.id && t.id.toLowerCase() === value.toLowerCase()) || null;
}

export { lookupHiddenTape };
