(async () => {
  const videos = Array.from(document.querySelectorAll('video'))
    .filter(video => video.readyState != 0)
    .filter(video => video.disablePictureInPicture == false)
    .sort((v1, v2) => {
      if ((v1.paused ^ v2.paused) == false) {
        const v1Rect = v1.getClientRects()[0];
        const v2Rect = v2.getClientRects()[0];
        return ((v2Rect.width * v2Rect.height) - (v1Rect.width * v1Rect.height));
      } else if (!v1.paused) {
        return 1;
      } else {
        return -1;
      }
    });

  if (videos.length === 0)
    return;

  const video = videos[0];
  await video.requestPictureInPicture();
})();
