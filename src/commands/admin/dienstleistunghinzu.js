const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Service = require('../../models/Service');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dienstleistung-hinzu')
    .setDescription('Füge eine Dienstleistung zum Shop hinzu')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Name der Dienstleistung').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('beschreibung').setDescription('Beschreibung der Dienstleistung').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('preis').setDescription('Preis in Coins').setRequired(true).setMinValue(1)
    )
    .addUserOption(opt =>
      opt.setName('anbieter').setDescription('Nutzer, der die Dienstleistung anbietet').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const name = interaction.options.getString('name');
    const description = interaction.options.getString('beschreibung');
    const price = interaction.options.getInteger('preis');
    const provider = interaction.options.getUser('anbieter');

    try {
      await Service.create({
        guildId: interaction.guild.id,
        name,
        description,
        price,
        providerId: provider.id,
      });

      const embed = createEmbed({
        title: 'Dienstleistung hinzugefügt ✅',
        color: COLORS.MARKET,
        fields: [
          { name: 'Name', value: name, inline: true },
          { name: 'Preis', value: formatCoins(price), inline: true },
          { name: 'Anbieter', value: `${provider}`, inline: true },
        ],
        description: `> ${description}`,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      if (err.code === 11000) {
        return interaction.reply({ content: '❌ Eine Dienstleistung mit diesem Namen existiert bereits.', ephemeral: true });
      }
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
