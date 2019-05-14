(() => {
    const videos = Array.from(document.querySelectorAll('video'))
        .filter(video => video.readyState != 0)
        .filter(video => video.disablePictureInPicture == false)
        .filter(video => video.paused == false);
    return videos.length > 0;
})();