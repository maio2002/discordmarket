const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const TradeOffer = require('../models/TradeOffer');
const coinService = require('./coinService');
const xpService = require('./xpService');
const { createEmbed, COLORS } = require('../utils/embedBuilder');
const { formatCoins } = require('../utils/formatters');
const logger = require('../utils/logger');

async function createOffer(guildId, sellerId, type, description, price, roleId = null, roleName = null) {
  const offer = await TradeOffer.create({
    guildId,
    sellerId,
    type,
    description,
    price,
    roleId,
    roleName,
    sellerApproved: true,
  });
  return offer;
}

async function getOffers(guildId, page = 1, perPage = 10, statusFilter = null) {
  const query = { guildId };
  if (statusFilter) {
    query.status = statusFilter;
  }
  const skip = (page - 1) * perPage;
  const offers = await TradeOffer.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)
    .lean();
  const total = await TradeOffer.countDocuments(query);
  return { offers, total, totalPages: Math.ceil(total / perPage) };
}

async function getUserOffers(guildId, userId) {
  return TradeOffer.find({
    guildId,
    sellerId: userId,
    status: { $in: ['active', 'pending_approval'] },
  })
    .sort({ createdAt: -1 })
    .lean();
}

async function cancelOffer(guildId, offerId, userId) {
  const offer = await TradeOffer.findOne({ _id: offerId, guildId, sellerId: userId });
  if (!offer) throw new Error('Angebot nicht gefunden oder gehört dir nicht.');
  if (offer.status !== 'active') throw new Error('Dieses Angebot kann nicht mehr abgebrochen werden.');

  offer.status = 'cancelled';
  await offer.save();
  return offer;
}

async function acceptOffer(guildId, offerId, buyerId, guild) {
  const offer = await TradeOffer.findOne({ _id: offerId, guildId, status: 'active' });
  if (!offer) throw new Error('Angebot nicht gefunden oder nicht mehr verfügbar.');
  if (offer.sellerId === buyerId) throw new Error('Du kannst dein eigenes Angebot nicht annehmen.');

  const buyer = await xpService.getOrCreateUser(guildId, buyerId);
  if (buyer.coins < offer.price) {
    throw new Error(`Nicht genug Coins. Benötigt: ${formatCoins(offer.price)}`);
  }

  if (offer.type === 'service') {
    await coinService.transfer(guildId, buyerId, offer.sellerId, offer.price, 'trade', `Handel: ${offer.description}`);

    offer.buyerId = buyerId;
    offer.buyerApproved = true;
    offer.status = 'completed';
    await offer.save();

    return { offer, completed: true };
  }

  if (offer.type === 'role' && offer.roleId) {
    await coinService.transfer(guildId, buyerId, offer.sellerId, offer.price, 'trade', `Rollen-Handel: ${offer.roleName}`);

    try {
      const sellerMember = await guild.members.fetch(offer.sellerId);
      const buyerMember = await guild.members.fetch(buyerId);

      if (sellerMember.roles.cache.has(offer.roleId)) {
        await sellerMember.roles.remove(offer.roleId);
      }
      await buyerMember.roles.add(offer.roleId);
    } catch (err) {
      logger.error('Fehler beim Rollen-Transfer:', err);
    }

    offer.buyerId = buyerId;
    offer.buyerApproved = true;
    offer.status = 'completed';
    await offer.save();

    return { offer, completed: true };
  }

  offer.buyerId = buyerId;
  offer.buyerApproved = true;
  offer.status = 'completed';
  await offer.save();

  return { offer, completed: true };
}

async function denyOffer(guildId, offerId, userId) {
  const offer = await TradeOffer.findOne({ _id: offerId, guildId });
  if (!offer) throw new Error('Angebot nicht gefunden.');
  if (offer.status !== 'pending_approval') throw new Error('Dieses Angebot wartet nicht auf Genehmigung.');

  offer.status = 'denied';
  await offer.save();
  return offer;
}

function createOfferEmbed(offer, guild) {
  const typeLabel = offer.type === 'role' ? '🏷️ Rolle' : '🔧 Dienstleistung';
  const fields = [
    { name: 'Typ', value: typeLabel, inline: true },
    { name: 'Preis', value: formatCoins(offer.price), inline: true },
    { name: 'Verkäufer', value: `<@${offer.sellerId}>`, inline: true },
    { name: 'Beschreibung', value: offer.description, inline: false },
  ];

  if (offer.roleName) {
    fields.push({ name: 'Rolle', value: offer.roleName, inline: true });
  }

  return createEmbed({
    title: `Angebot #${offer._id.toString().slice(-6)}`,
    color: COLORS.TRADE,
    fields,
    footer: `ID: ${offer._id}`,
  });
}

function createTradeButtons(offerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`trade_accept_${offerId}`)
      .setLabel('Annehmen')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`trade_deny_${offerId}`)
      .setLabel('Ablehnen')
      .setStyle(ButtonStyle.Danger)
  );
}

async function handleTradeButton(interaction) {
  const customId = interaction.customId;
  const isAccept = customId.startsWith('trade_accept_');
  const offerId = customId.replace(/^trade_(accept|deny)_/, '');

  if (isAccept) {
    try {
      const { offer, completed } = await acceptOffer(
        interaction.guild.id,
        offerId,
        interaction.user.id,
        interaction.guild
      );

      if (completed) {
        const embed = createEmbed({
          title: 'Handel abgeschlossen! ✅',
          color: COLORS.SUCCESS,
          fields: [
            { name: 'Angebot', value: offer.description, inline: false },
            { name: 'Verkäufer', value: `<@${offer.sellerId}>`, inline: true },
            { name: 'Käufer', value: `<@${offer.buyerId}>`, inline: true },
            { name: 'Preis', value: formatCoins(offer.price), inline: true },
          ],
        });
        await interaction.update({ embeds: [embed], components: [] });
      }
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  } else {
    await interaction.reply({ content: 'Handel abgelehnt.', ephemeral: true });
  }
}

module.exports = {
  createOffer,
  getOffers,
  getUserOffers,
  cancelOffer,
  acceptOffer,
  denyOffer,
  createOfferEmbed,
  createTradeButtons,
  handleTradeButton,
};
