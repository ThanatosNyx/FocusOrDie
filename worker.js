// Este script roda fora da aba principal e não dorme!
setInterval(() => {
    postMessage('tick');
}, 1000);