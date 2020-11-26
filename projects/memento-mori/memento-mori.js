function LifeGraph(config) {
  console.log("Life Graph");
  config.currentWeekInLife = weeksBetween(config.startDate, config.currentDate);

  console.log(config);

  var vloc = 0;
  var ctx = config.context;

  ctx.clearRect(0, 0, config.canvas.width, config.canvas.height);
  setCellTheme(ctx, "");

  // title
  ctx.font = '48px verdana';
  var text = "Memento Mori";
  ctx.fillText(text, (config.width - ctx.measureText(text).width) / 2, getVerticalLocation(50));

  // Weeks per year
  ctx.font = '10px verdana ';
  drawText("WEEKS  -------------->", 40, getVerticalLocation(20), '10px verdana', 'rgb(0, 0, 0)');
  drawVerticalText("<------------YEARS", -190, 15, '10px verdana', 'rgb(0, 0, 0)');

  var totalWeeks = 0;
  setCellTheme(ctx, "past");
  // years
  for (var year = 0; year < config.lifeExpectancy; year++) {
    var x = 25;
    var y = getVerticalLocation(config.cellSize + config.cellPadding);

    // skip row for decades
    if (year > 0 && (year) % 10 == 0)
      y = getVerticalLocation(config.cellSize + config.cellPadding);

    // Draw week numbers
    if (year == 0) {
      for (var wt = 1; wt <= 52; wt++) {
        drawText("" + wt, x + ((config.cellSize + config.cellPadding) * wt), y, '10px serif', 'rgb(0, 0, 0)');
      }

      y = getVerticalLocation(config.cellPadding);
    }

    x = 40;

    //Draw year number
    drawText(year, x - 15, y + config.cellSize, '10px serif', 'rgb(0, 0, 0)');

    // weeks or rows
    for (var w = 0; w < 52; w++) {

      if (totalWeeks < config.currentWeekInLife) {
        drawSolidRect(x, y, config.cellSize, config.cellSize);
      }

      if (totalWeeks == config.currentWeekInLife) {
        setCellTheme(ctx, "today");
        drawSolidRect(x, y, config.cellSize, config.cellSize);
      }

      if (totalWeeks > config.currentWeekInLife) {
        setCellTheme(ctx, "future");
        drawStrokeRect(x, y, config.cellSize, config.cellSize);
      }

      totalWeeks++;
      x += (config.cellPadding + config.cellSize);
    }
  }

  function drawText(text, x, y, style, colour) {
    ctx.save();
    ctx.font = style;
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawVerticalText(text, x, y, style, colour) {
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.font = style;
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawSolidRect(x, y, h, w, style) {
    ctx.save();
    ctx.fillStyle = style;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function drawStrokeRect(x, y, h, w, style) {
    ctx.save();
    ctx.strokeStyle = style;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function getVerticalLocation(offset) {
    vloc = vloc + offset;
    return vloc;
  }

  function weeksBetween(d1, d2) {
    return Math.round((d2 - d1) / (7 * 24 * 60 * 60 * 1000));
  }

  function setCellTheme(ctx, theme) {
    if (theme == "" || theme == "reset") // reset
    {
      ctx.fillStyle = 'rgb(0, 0, 0)';
    }

    if (theme == "past")
      ctx.fillStyle = 'rgb(0, 0, 0)';

    if (theme == "today")
      ctx.fillStyle = 'rgb(0, 255, 0)';

    if (theme == "future") {
      ctx.fillStyle = "#FFF";
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
    }
  }
}

function draw() {
  console.log("starting");

  var config = {};
  config.canvas = document.getElementById("canvas");
  config.context = config.canvas.getContext('2d');

  //layout
  config.height = config.canvas.height;
  config.width = config.canvas.width;
  config.cellPadding = 4;
  config.cellSize = 10;

  // presentation
  config.startDate = new Date(1980, 01, 01);
  config.startDate = new Date(document.getElementById("dob").value);
  config.currentDate = new Date();
  config.lifeExpectancy = document.getElementById("expectancy").value;

  LifeGraph(config);
};