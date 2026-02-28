const { SlashCommandBuilder } = require('discord.js');
const { getArenaOverviewPayload } = require('../../services/arenaService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('arena')
    .setDescription('Arena-System für Debatten und Gildenkämpfe'),

  async execute(interaction) {
    const payload = await getArenaOverviewPayload(interaction.guild.id, interaction.user.id, interaction.member);
    return interaction.reply({ ...payload, ephemeral: true });
  },
};
