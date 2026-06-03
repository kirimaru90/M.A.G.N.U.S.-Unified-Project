let navigationHistory = [];

function pushHistory(nodeId) {
    navigationHistory.push(nodeId);
}

function popHistory() {
    return navigationHistory.pop();
}

function peekHistory() {
    return navigationHistory[navigationHistory.length - 1];
}

function getHistoryLength() {
    return navigationHistory.length;
}

function clearHistory() {
    navigationHistory = [];
}

export { pushHistory, popHistory, peekHistory, getHistoryLength, clearHistory };
