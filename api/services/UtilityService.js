function toPercent(value, max) {
  max = max || 100;
  return parseFloat( (((value / max) * 100) || 0 ).toFixed(2, 10) );
}

function refinePercent(items, field, threshold) {
  threshold = threshold || 0;

  if (items.length <= 0) return items;

  var sumPercent = _.pluck(items, field).reduce(sum);
  var diff = 100 - sumPercent;

  // Skip refinement if below threshold.
  if (Math.abs(diff) < threshold) {
    return items;
  }

  var first = _.first(items);
  var last = _.last(items);

  if (diff > 0) {
    first[field] = parseFloat((first[field] + diff).toFixed(2));
  }
  else if (diff < 0) {
    last[field] = parseFloat((last[field] + diff).toFixed(2));
    // prevent value below zero
    if (last[field] < 0) {
      last[field] = 0;
    }
  }

  return items;

  function sum(a, b) {
    return a + b;
  }
}

module.exports = {
  toPercent: toPercent,
  refinePercent: refinePercent
};
