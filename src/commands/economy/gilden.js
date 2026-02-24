const { SlashCommandBuilder } = require('discord.js');
const { getGildenPayload } = require('../../services/guildService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gilden')
    .setDescription('Zeigt deine Gilde an oder lass dich eine gründen'),

  async execute(interaction) {
    const payload = await getGildenPayload(interaction.guild.id, interaction.user.id);
    return interaction.reply({ ...payload, ephemeral: true });
  },
};
