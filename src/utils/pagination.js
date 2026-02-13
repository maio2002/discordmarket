const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createPaginationRow(currentPage, totalPages, prefix) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`page_${prefix}_${currentPage - 1}`)
      .setLabel('◀ Zurück')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`page_${prefix}_info`)
      .setLabel(`${currentPage} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`page_${prefix}_${currentPage + 1}`)
      .setLabel('Weiter ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages)
  );
  return row;
}

async function handlePageButton(interaction) {
  if (!interaction.replied && !interaction.deferred) {
    await interaction.deferUpdate();
  }
}

module.exports = { createPaginationRow, handlePageButton };
