(async () => {
    const pipEle = document.pictureInPictureElement;
    if (pipEle) {
        if (pipEle.paused) {
            await pipEle.play();
        } else {
            await pipEle.pause();
        }
        return true
    }
    const playingVideos = Array.from(document.querySelectorAll('video'))
        .filter(video => video.readyState != 0)
        .filter(video => video.paused == false);
    if (playingVideos.length > 0) {
        await Promise.all(playingVideos.map(video => {
            video.pause();
        }));
        return true;
    }

    const pausingVideos = Array.from(document.querySelectorAll('video'))
        .filter(video => video.readyState != 0)
        .filter(video => video.paused == true)
        .sort((v1, v2) => {
            const v1Rect = v1.getClientRects()[0];
            const v2Rect = v1.getClientRects()[0];
            return ((v2Rect.width * v2Rect.height) - (v1Rect.width * v1Rect.height));
          });
    if (pausingVideos.length === 0) {
        return false
    }
    const video = pausingVideos[0];
    await video.play();
    return true;
})();