const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`Unbekanntes Kommando: ${interaction.commandName}`);
        return;
      }
      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Fehler bei /${interaction.commandName}:`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        logger.error(`Autocomplete-Fehler bei /${interaction.commandName}:`, error);
      }
      return;
    }

    if (interaction.isButton()) {
      try {
        await handleButton(interaction);
      } catch (error) {
        logger.error(`Button-Fehler (${interaction.customId}):`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isUserSelectMenu()) {
      try {
        await handleUserSelectMenu(interaction);
      } catch (error) {
        logger.error(`UserSelect-Fehler (${interaction.customId}):`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      try {
        await handleModal(interaction);
      } catch (error) {
        logger.error(`Modal-Fehler (${interaction.customId}):`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      try {
        await handleSelectMenu(interaction);
      } catch (error) {
        logger.error(`Select-Fehler (${interaction.customId}):`, error);
        const reply = {
          content: 'Es ist ein Fehler aufgetreten.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    }
  },
};

async function handleButton(interaction) {
  const id = interaction.customId;

  if (id.startsWith('approve_role_') || id.startsWith('deny_role_')) {
    const approvalService = require('../services/approvalService');
    return approvalService.handleRoleApprovalButton(interaction);
  }

  if (id.startsWith('approve_coins_') || id.startsWith('deny_coins_')) {
    const approvalService = require('../services/approvalService');
    return approvalService.handleCoinsApprovalButton(interaction);
  }

  if (id.startsWith('trade_accept_') || id.startsWith('trade_deny_')) {
    const tradeService = require('../services/tradeService');
    return tradeService.handleTradeButton(interaction);
  }

  if (id.startsWith('page_')) {
    const pagination = require('../utils/pagination');
    return pagination.handlePageButton(interaction);
  }

  // Quest ticket: Geschafft
  if (id.startsWith('quest_complete_')) {
    const questService = require('../services/questService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const parts = id.split('_');
    const questId = parts[2];
    const userId = parts[3];

    try {
      const quest = await questService.completeQuestForUser(
        interaction.guild.id, questId, userId, interaction.user.id, interaction.guild
      );
      const embed = createEmbed({
        title: '✅ Quest bestanden!',
        color: COLORS.SUCCESS,
        description: `<@${userId}> hat die Quest **${quest.title}** abgeschlossen und ${formatCoins(quest.reward)} erhalten.\n\nDieser Channel wird in 5 Sekunden gelöscht.`,
      });
      return interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
      const embed = createEmbed({
        title: '⚠️ Fehler',
        color: COLORS.ERROR,
        description: err.message,
      });
      return interaction.reply({ embeds: [embed], flags: 64 });
    }
  }

  // Quest ticket: Nicht geschafft
  if (id.startsWith('quest_fail_')) {
    const questService = require('../services/questService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const parts = id.split('_');
    const questId = parts[2];
    const userId = parts[3];

    try {
      await questService.failQuestForUser(
        interaction.guild.id, questId, userId, interaction.user.id, interaction.guild
      );
      const embed = createEmbed({
        title: '❌ Quest nicht geschafft',
        color: COLORS.ERROR,
        description: `<@${userId}> hat die Quest nicht bestanden.\n\nDieser Channel wird in 5 Sekunden gelöscht.`,
      });
      return interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
      const embed = createEmbed({
        title: '⚠️ Fehler',
        color: COLORS.ERROR,
        description: err.message,
      });
      return interaction.reply({ embeds: [embed], flags: 64 });
    }
  }

  // Shop open button
  if (id === 'shop_open') {
    const { buildShopResponse } = require('../services/shopService');
    const { embed, components } = await buildShopResponse(interaction.guild.id, 'roles', 1);
    return interaction.reply({ embeds: [embed], components, ephemeral: true });
  }

  // Shop balance button
  if (id === 'shop_balance') {
    const coinService = require('../services/coinService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const balance = await coinService.getBalance(interaction.guild.id, interaction.user.id);
    const embed = createEmbed({
      title: '💰 Dein Kontostand',
      description: `Du hast **${formatCoins(balance)}**`,
      color: COLORS.GOLD,
      thumbnail: interaction.user.displayAvatarURL(),
    });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Direct offer accept
  if (id.startsWith('trade_accept_direct_')) {
    const coinService = require('../services/coinService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const Offer = require('../models/Offer');
    const offerId = id.replace('trade_accept_direct_', '');
    const offer = await Offer.findById(offerId);

    if (!offer || offer.status !== 'pending') {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht mehr gültig.', ephemeral: true });
    }
    if (interaction.user.id !== offer.targetId) {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht für dich.', ephemeral: true });
    }

    try {
      await coinService.transfer(interaction.guild.id, offer.targetId, offer.senderId, offer.price, 'trade', 'Direktes Angebot angenommen');
      offer.status = 'accepted';
      await offer.save();

      const channelEmbed = createEmbed({
        title: '✅ Angebot angenommen',
        color: COLORS.SUCCESS,
        description: `<@${offer.targetId}> hat das Angebot von <@${offer.senderId}> für **${formatCoins(offer.price)}** angenommen.`,
      });
      await interaction.message.edit({ embeds: [channelEmbed], components: [] });

      const replyEmbed = createEmbed({
        title: '✅ Angebot angenommen!',
        color: COLORS.SUCCESS,
        description: `Du hast **${formatCoins(offer.price)}** an <@${offer.senderId}> bezahlt.`,
      });
      return interaction.reply({ embeds: [replyEmbed], ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }

  // Direct role trade accept
  if (id.startsWith('trade_accept_role_')) {
    const coinService = require('../services/coinService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const Offer = require('../models/Offer');
    const offerId = id.replace('trade_accept_role_', '');
    const offer = await Offer.findById(offerId);

    if (!offer || offer.status !== 'pending') {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht mehr gültig.', ephemeral: true });
    }
    if (interaction.user.id !== offer.targetId) {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht für dich.', ephemeral: true });
    }

    try {
      await coinService.transfer(interaction.guild.id, offer.targetId, offer.senderId, offer.price, 'trade', `Rollenkauf: <@&${offer.roleId}>`);

      const sellerMember = await interaction.guild.members.fetch(offer.senderId);
      const buyerMember = await interaction.guild.members.fetch(offer.targetId);

      if (sellerMember.roles.cache.has(offer.roleId)) {
        await sellerMember.roles.remove(offer.roleId).catch(() => {});
      }
      await buyerMember.roles.add(offer.roleId).catch(() => {});

      offer.status = 'accepted';
      await offer.save();

      const channelEmbed = createEmbed({
        title: '✅ Rollenangebot angenommen',
        color: COLORS.SUCCESS,
        description: `<@${offer.targetId}> hat die Rolle <@&${offer.roleId}> von <@${offer.senderId}> für **${formatCoins(offer.price)}** gekauft.`,
      });
      await interaction.message.edit({ embeds: [channelEmbed], components: [] });

      const replyEmbed = createEmbed({
        title: '✅ Rollenangebot angenommen!',
        color: COLORS.SUCCESS,
        description: `Du hast **${formatCoins(offer.price)}** bezahlt und die Rolle <@&${offer.roleId}> erhalten.`,
      });
      return interaction.reply({ embeds: [replyEmbed], ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }

  // Direct offer/role deny
  if (id.startsWith('trade_deny_direct_')) {
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const Offer = require('../models/Offer');
    const offerId = id.replace('trade_deny_direct_', '');
    const offer = await Offer.findById(offerId);

    if (!offer || offer.status !== 'pending') {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht mehr gültig.', ephemeral: true });
    }
    if (interaction.user.id !== offer.targetId) {
      return interaction.reply({ content: '❌ Dieses Angebot ist nicht für dich.', ephemeral: true });
    }

    offer.status = 'denied';
    await offer.save();

    const channelEmbed = createEmbed({
      title: '❌ Angebot abgelehnt',
      color: COLORS.ERROR,
      description: `<@${offer.targetId}> hat das Angebot von <@${offer.senderId}> abgelehnt.`,
    });
    await interaction.message.edit({ embeds: [channelEmbed], components: [] });

    return interaction.reply({ content: '❌ Du hast das Angebot abgelehnt.', ephemeral: true });
  }

  // Shop send button - show user select
  if (id === 'shop_send') {
    const { ActionRowBuilder, UserSelectMenuBuilder } = require('discord.js');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const embed = createEmbed({
      title: '📤 Senden',
      description: 'Wähle einen User aus, an den du etwas senden möchtest.',
      color: COLORS.MARKET,
    });
    const row = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('shop_send_target')
        .setPlaceholder('User auswählen...')
    );
    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // Shop send action buttons (coins or offer)
  if (id.startsWith('shop_send_coins_') || id.startsWith('shop_send_offer_')) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const targetId = id.startsWith('shop_send_coins_')
      ? id.replace('shop_send_coins_', '')
      : id.replace('shop_send_offer_', '');

    if (id.startsWith('shop_send_coins_')) {
      const modal = new ModalBuilder()
        .setCustomId(`modal_send_coins_${targetId}`)
        .setTitle('Coins senden');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Betrag')
            .setPlaceholder('z.B. 100')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
      );
      return interaction.showModal(modal);
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_send_offer_${targetId}`)
      .setTitle('Angebot senden');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Beschreibung')
          .setPlaceholder('Was bietest du an?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('price')
          .setLabel('Preis (Coins)')
          .setPlaceholder('z.B. 500')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
    );
    return interaction.showModal(modal);
  }

  // Shop send role - show own roles as string select
  if (id.startsWith('shop_send_role_')) {
    const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const targetId = id.replace('shop_send_role_', '');

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const userRoles = member.roles.cache
      .filter(r => r.id !== interaction.guild.id && !r.managed)
      .sort((a, b) => b.position - a.position)
      .first(25);

    if (userRoles.length === 0) {
      return interaction.reply({ content: '❌ Du besitzt keine Rollen, die du anbieten kannst.', ephemeral: true });
    }

    const embed = createEmbed({
      title: '🏷️ Rolle anbieten',
      description: 'Wähle eine deiner Rollen aus, die du anbieten möchtest.',
      color: COLORS.MARKET,
    });
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`shop_send_role_select_${targetId}`)
      .setPlaceholder('Rolle auswählen...')
      .addOptions(userRoles.map(r => ({
        label: r.name,
        value: r.id,
        emoji: '🏷️',
      })));
    const row = new ActionRowBuilder().addComponents(selectMenu);
    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // Shop offers - show pending offers for this user
  if (id === 'shop_offers') {
    const Offer = require('../models/Offer');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');

    const offers = await Offer.find({
      guildId: interaction.guild.id,
      targetId: interaction.user.id,
      status: 'pending',
    }).sort({ createdAt: -1 }).limit(25).lean();

    if (offers.length === 0) {
      const embed = createEmbed({
        title: '📬 Deine Angebote',
        description: 'Du hast keine offenen Angebote.',
        color: COLORS.MARKET,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const lines = offers.map((o, i) => {
      if (o.type === 'role') {
        return `**${i + 1}.** 🏷️ Rolle: **${o.roleName}**\n> Von: <@${o.senderId}> • Preis: ${formatCoins(o.price)}`;
      }
      if (o.type === 'offer') {
        return `**${i + 1}.** 📋 Angebot von <@${o.senderId}>\n> ${o.description}\n> Preis: ${formatCoins(o.price)}`;
      }
      return `**${i + 1}.** 💰 ${formatCoins(o.price)} von <@${o.senderId}>`;
    });

    const embed = createEmbed({
      title: '📬 Deine Angebote',
      description: lines.join('\n\n'),
      color: COLORS.MARKET,
      footer: `${offers.length} offene${offers.length === 1 ? 's' : ''} Angebot${offers.length === 1 ? '' : 'e'}`,
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Shop category navigation
  if (id.startsWith('shop_cat_')) {
    const { buildShopResponse } = require('../services/shopService');
    const category = id.replace('shop_cat_', '');
    const { embed, components } = await buildShopResponse(interaction.guild.id, category, 1);
    return interaction.update({ embeds: [embed], components });
  }

  // Shop pagination
  if (id.startsWith('shop_page_')) {
    const { buildShopResponse } = require('../services/shopService');
    // Format: shop_page_{category}_{pageNum}
    const parts = id.split('_');
    const category = parts[2];
    const page = parseInt(parts[3]);
    if (isNaN(page)) return interaction.deferUpdate();
    const { embed, components } = await buildShopResponse(interaction.guild.id, category, page);
    return interaction.update({ embeds: [embed], components });
  }
}

async function handleSelectMenu(interaction) {
  const id = interaction.customId;

  // Buy role from shop
  if (id.startsWith('shop_buy_role_')) {
    const marketService = require('../services/marketService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const roleName = interaction.values[0];

    try {
      const { marketRole, price } = await marketService.buyRole(
        interaction.guild.id,
        interaction.user.id,
        roleName,
        interaction.guild
      );
      const embed = createEmbed({
        title: '🎉 Rolle gekauft!',
        color: COLORS.SUCCESS,
        fields: [
          { name: 'Rolle', value: marketRole.name, inline: true },
          { name: 'Preis', value: formatCoins(price), inline: true },
          { name: 'Verbleibend', value: `${marketRole.totalStock - marketRole.purchased}`, inline: true },
        ],
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
    return;
  }

  // Buy prestige role
  if (id.startsWith('shop_buy_prestige_')) {
    const marketService = require('../services/marketService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const roleName = interaction.values[0];

    try {
      const { marketRole, price } = await marketService.buyRole(
        interaction.guild.id,
        interaction.user.id,
        roleName,
        interaction.guild
      );
      const embed = createEmbed({
        title: '⭐ Prestige-Rolle gekauft!',
        color: COLORS.GOLD,
        fields: [
          { name: 'Rolle', value: marketRole.name, inline: true },
          { name: 'Preis', value: formatCoins(price), inline: true },
        ],
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
    return;
  }

  // Claim quest
  if (id.startsWith('shop_quest_claim_')) {
    const questService = require('../services/questService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const questId = interaction.values[0];

    try {
      const { quest, channelId } = await questService.claimQuest(
        interaction.guild.id,
        questId,
        interaction.user.id,
        interaction.guild
      );
      const embed = createEmbed({
        title: '📋 Quest angenommen!',
        color: COLORS.SUCCESS,
        fields: [
          { name: 'Quest', value: quest.title, inline: true },
          { name: 'Belohnung', value: formatCoins(quest.reward), inline: true },
        ],
        description: channelId
          ? `Ein Ticket-Channel wurde erstellt: <#${channelId}>`
          : 'Viel Erfolg!',
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
    return;
  }

  // Apply for job
  if (id.startsWith('shop_apply_job_')) {
    const JobListing = require('../models/JobListing');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const jobId = interaction.values[0];

    const listing = await JobListing.findById(jobId).lean();
    if (!listing || !listing.isOpen) {
      return interaction.reply({ content: '❌ Diese Stelle ist nicht mehr verfügbar.', ephemeral: true });
    }

    const embed = createEmbed({
      title: '💼 Bewerbung',
      color: COLORS.JOB,
      description: `Stelle: **${listing.title}**\n\nBewirb dich hier: <#${listing.applicationChannelId}>`,
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Role select for sending a role offer (StringSelectMenu)
  if (id.startsWith('shop_send_role_select_')) {
    const targetId = id.replace('shop_send_role_select_', '');
    const roleId = interaction.values[0];
    const role = await interaction.guild.roles.fetch(roleId);

    if (!role) {
      return interaction.reply({ content: '❌ Diese Rolle existiert nicht mehr.', ephemeral: true });
    }

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`modal_send_role_${targetId}_${roleId}`)
      .setTitle(`Rolle anbieten: ${role.name.slice(0, 30)}`);
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('price')
          .setLabel('Preis (Coins)')
          .setPlaceholder('z.B. 500')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
    );
    return interaction.showModal(modal);
  }
}

async function handleUserSelectMenu(interaction) {
  const id = interaction.customId;

  if (id === 'shop_send_target') {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const targetUser = interaction.users.first();

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: '❌ Du kannst nichts an dich selbst senden.', ephemeral: true });
    }
    if (targetUser.bot) {
      return interaction.reply({ content: '❌ Du kannst nichts an Bots senden.', ephemeral: true });
    }

    const embed = createEmbed({
      title: '📤 Senden an ' + targetUser.displayName,
      description: 'Was möchtest du senden?',
      color: COLORS.MARKET,
      thumbnail: targetUser.displayAvatarURL(),
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_send_coins_${targetUser.id}`)
        .setLabel('Coins senden')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`shop_send_offer_${targetUser.id}`)
        .setLabel('Angebot senden')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`shop_send_role_${targetUser.id}`)
        .setLabel('Rolle anbieten')
        .setEmoji('🏷️')
        .setStyle(ButtonStyle.Secondary),
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
}

async function handleModal(interaction) {
  const id = interaction.customId;

  // Coins senden
  if (id.startsWith('modal_send_coins_')) {
    const coinService = require('../services/coinService');
    const { createEmbed, COLORS } = require('../utils/embedBuilder');
    const { formatCoins } = require('../utils/formatters');
    const targetId = id.replace('modal_send_coins_', '');
    const amount = parseInt(interaction.fields.getTextInputValue('amount'));

    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({ content: '❌ Bitte gib einen gültigen Betrag ein.', ephemeral: true });
    }

    await coinService.transfer(
      interaction.guild.id,
      interaction.user.id,
      targetId,
      amount,
      'trade',
      `Coins gesendet an <@${targetId}>`
    );

    const embed = createEmbed({
      title: '✅ Coins gesendet!',
      color: COLORS.SUCCESS,
      description: `Du hast **${formatCoins(amount)}** an <@${targetId}> gesendet.`,
    });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Rolle anbieten
  if (id.startsWith('modal_send_role_')) {
    const Offer = require('../models/Offer');
    // Format: modal_send_role_{targetId}_{roleId}
    const parts = id.split('_');
    const targetId = parts[3];
    const roleId = parts[4];
    const price = parseInt(interaction.fields.getTextInputValue('price'));

    if (isNaN(price) || price <= 0) {
      return interaction.reply({ content: '❌ Bitte gib einen gültigen Preis ein.', ephemeral: true });
    }

    const role = await interaction.guild.roles.fetch(roleId);
    if (!role) {
      return interaction.reply({ content: '❌ Diese Rolle existiert nicht mehr.', ephemeral: true });
    }

    await Offer.create({
      guildId: interaction.guild.id,
      senderId: interaction.user.id,
      targetId,
      type: 'role',
      price,
      roleId,
      roleName: role.name,
    });

    return interaction.reply({
      content: `✅ Rollenangebot für **${role.name}** an <@${targetId}> gesendet! Der User kann es unter 📬 Angebote einsehen.`,
      ephemeral: true,
    });
  }

  // Angebot senden
  if (id.startsWith('modal_send_offer_')) {
    const Offer = require('../models/Offer');
    const targetId = id.replace('modal_send_offer_', '');
    const description = interaction.fields.getTextInputValue('description');
    const price = parseInt(interaction.fields.getTextInputValue('price'));

    if (isNaN(price) || price <= 0) {
      return interaction.reply({ content: '❌ Bitte gib einen gültigen Preis ein.', ephemeral: true });
    }

    await Offer.create({
      guildId: interaction.guild.id,
      senderId: interaction.user.id,
      targetId,
      type: 'offer',
      description,
      price,
    });

    return interaction.reply({
      content: `✅ Angebot an <@${targetId}> gesendet! Der User kann es unter 📬 Angebote einsehen.`,
      ephemeral: true,
    });
  }
}
