// nebula.js
// Load nebula overlay images for each sector
const nebulaImages = [];
['nebula1.svg','nebula2.svg','nebula3.svg','nebula4.svg','nebula5.svg']
  .forEach(src => {
    const img = new Image();
    img.src = src;
    nebulaImages.push(img);
  });
export default nebulaImages;