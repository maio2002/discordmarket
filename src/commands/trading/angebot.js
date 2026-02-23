const { SlashCommandBuilder } = require('discord.js');
const tradeService = require('../../services/tradeService');
const GuildConfig = require('../../models/GuildConfig');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('angebot')
    .setDescription('Erstelle oder verwalte Handelsangebote')
    .addSubcommand(sub =>
      sub
        .setName('erstellen')
        .setDescription('Erstelle ein neues Handelsangebot')
        .addStringOption(opt =>
          opt
            .setName('typ')
            .setDescription('Art des Angebots')
            .setRequired(true)
            .addChoices(
              { name: 'Rolle', value: 'role' },
              { name: 'Dienstleistung', value: 'service' }
            )
        )
        .addStringOption(opt =>
          opt.setName('beschreibung').setDescription('Beschreibung des Angebots').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('preis').setDescription('Preis in Coins').setRequired(true).setMinValue(1)
        )
        .addRoleOption(opt =>
          opt.setName('rolle').setDescription('Rolle (nur bei Typ Rolle)')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('abbrechen')
        .setDescription('Breche ein eigenes Angebot ab')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Angebots-ID').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(0),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'erstellen') {
      const type = interaction.options.getString('typ');
      const description = interaction.options.getString('beschreibung');
      const price = interaction.options.getInteger('preis');
      const role = interaction.options.getRole('rolle');

      if (type === 'role' && !role) {
        return interaction.reply({
          content: '❌ Für ein Rollen-Angebot musst du eine Rolle angeben.',
          ephemeral: true,
        });
      }

      if (type === 'role' && role) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(role.id)) {
          return interaction.reply({
            content: '❌ Du besitzt diese Rolle nicht.',
            ephemeral: true,
          });
        }
      }

      const offer = await tradeService.createOffer(
        interaction.guild.id,
        interaction.user.id,
        type,
        description,
        price,
        role?.id || null,
        role?.name || null
      );

      const embed = tradeService.createOfferEmbed(offer, interaction.guild);
      const buttons = tradeService.createTradeButtons(offer._id);

      const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
      if (config?.marketChannelId) {
        const channel = await interaction.guild.channels.fetch(config.marketChannelId).catch(() => null);
        if (channel) {
          const msg = await channel.send({ embeds: [embed], components: [buttons] });
          offer.messageId = msg.id;
          await offer.save();
        }
      }

      await interaction.reply({
        content: `Angebot erstellt! ID: \`${offer._id}\`\nPreis: **${formatCoins(price)}**`,
        ephemeral: true,
      });
    }

    if (sub === 'abbrechen') {
      const offerId = interaction.options.getString('id');
      try {
        await tradeService.cancelOffer(interaction.guild.id, offerId, interaction.user.id);
        await interaction.reply({ content: 'Angebot abgebrochen. ✅', ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
      }
    }
  },
};
