function toPercent(value, max) {
  return parseFloat( (((value / max) * 100) || 0 ).toFixed(2, 10) );
}

function refinePercent(items, field) {
  if (items.length <= 0) return items;

  var aggregatedPercent = _.reduce(_.pluck(items, 'percentOfReports'), function (sum, num) {
    return sum + num;
  });

  if (aggregatedPercent != 100) {
    _.last(items)[field] += 100 - aggregatedPercent;
  }

  return items;
}

module.exports = {
  toPercent: toPercent,
  refinePercent: refinePercent
};
