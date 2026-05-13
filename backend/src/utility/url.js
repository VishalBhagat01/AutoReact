function extractFileKey(url) {
    const match = url.match(/(?:file|design)\/([a-zA-Z0-9]+)/);

    return match ? match[1] : null;
}

module.exports = {
    extractFileKey
};