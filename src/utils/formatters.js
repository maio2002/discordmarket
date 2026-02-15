function formatNumber(num) {
  return num.toLocaleString('de-DE');
}

function formatCoins(amount) {
  return `${formatNumber(amount)} Coins`;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}T ${hours % 24}Std`;
  if (hours > 0) return `${hours}Std ${minutes % 60}Min`;
  if (minutes > 0) return `${minutes}Min ${seconds % 60}Sek`;
  return `${seconds}Sek`;
}

function formatTimestamp(date) {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

module.exports = { formatNumber, formatCoins, formatDuration, formatTimestamp };
