import { Router, Request, Response, NextFunction } from 'express';
import * as dealService from '../services/dealService';

export const dealRouter: Router = Router();

/**
 * @swagger
 * /deal/create:
 *   post:
 *     summary: Create a deal (voucher collection with batch claim links)
 *     tags: [Deals]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - creatorEmail
 *               - collectionName
 *               - merchantName
 *               - merchantAddress
 *               - voucherName
 *               - voucherType
 *               - voucherWorth
 *               - quantity
 *               - expiryDate
 *               - maxUses
 *             properties:
 *               creatorEmail:
 *                 type: string
 *                 format: email
 *                 example: "merchant@example.com"
 *                 description: Email address of the creator (must be a registered Verxio user)
 *               collectionName:
 *                 type: string
 *                 example: "Summer Sale Collection"
 *                 description: Name of the voucher collection
 *               merchantName:
 *                 type: string
 *                 example: "Acme Store"
 *                 description: Name of the merchant
 *               merchantAddress:
 *                 type: string
 *                 example: "123 Main St, City, State"
 *                 description: Physical address of the merchant
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 example: "contact@acmestore.com"
 *                 description: Contact email for the merchant
 *               category:
 *                 type: string
 *                 example: "Fashion"
 *                 description: Category of the deal
 *               description:
 *                 type: string
 *                 example: "Collection of summer sale vouchers"
 *                 description: Description of the deal collection
 *               imageURL:
 *                 type: string
 *                 format: uri
 *                 example: "https://gateway.pinata.cloud/ipfs/Qm..."
 *                 description: Image URL for the deal collection
 *               voucherName:
 *                 type: string
 *                 example: "20% Off Summer Sale"
 *                 description: Name of the voucher
 *               voucherType:
 *                 type: string
 *                 enum: [default, percentage_off, fixed_amount_off, buy_one_get_one, custom_reward, free_shipping, free_delivery, free_gift, free_item, free_trial, free_sample, free_consultation, free_repair]
 *                 example: "percentage_off"
 *                 description: Type of voucher
 *               voucherWorth:
 *                 type: number
 *                 example: 150
 *                 description: Worth/value of the voucher
 *               currencyCode:
 *                 type: string
 *                 example: "USD"
 *                 description: Currency code (e.g., USD, EUR, NGN)
 *               country:
 *                 type: string
 *                 example: "USA"
 *                 description: Country where the deal is available
 *               quantity:
 *                 type: integer
 *                 example: 100
 *                 description: Number of claim links to create (minimum 1)
 *               expiryDate:
 *                 type: string
 *                 example: "2025-12-31"
 *                 description: Expiry date in ISO format or DD/MM/YYYY format
 *               maxUses:
 *                 type: integer
 *                 example: 1
 *                 description: Maximum number of times a voucher can be used
 *               tradeable:
 *                 type: boolean
 *                 example: true
 *                 description: Whether the voucher is tradeable
 *               transferable:
 *                 type: boolean
 *                 example: false
 *                 description: Whether the voucher is transferable
 *               conditions:
 *                 type: string
 *                 example: "Minimum purchase of $50"
 *                 description: Conditions or terms for using this voucher
 *           examples:
 *             example1:
 *               summary: Create a deal with 100 vouchers
 *               value:
 *                 creatorEmail: "merchant@example.com"
 *                 collectionName: "Summer Sale Collection"
 *                 merchantName: "Acme Store"
 *                 merchantAddress: "123 Main St, City, State"
 *                 contactEmail: "contact@acmestore.com"
 *                 category: "Fashion"
 *                 description: "Collection of summer sale vouchers"
 *                 imageURL: "https://gateway.pinata.cloud/ipfs/Qm..."
 *                 voucherName: "20% Off Summer Sale"
 *                 voucherType: "percentage_off"
 *                 voucherWorth: 150
 *                 currencyCode: "USD"
 *                 country: "USA"
 *                 quantity: 100
 *                 expiryDate: "2025-12-31"
 *                 maxUses: 1
 *                 tradeable: true
 *                 transferable: false
 *                 conditions: "Minimum purchase of $50"
 *     responses:
 *       201:
 *         description: Deal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 deal:
 *                   type: object
 *                   properties:
 *                     dealId:
 *                       type: string
 *                       description: ID of the created deal record in the database
 *                     collectionId:
 *                       type: string
 *                       description: ID of the voucher collection
 *                     collectionAddress:
 *                       type: string
 *                       description: Public key address of the voucher collection
 *                     quantityCreated:
 *                       type: integer
 *                       description: Number of claim links successfully created
 *                     claimCodes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Array of claim codes for the created vouchers
 *       400:
 *         description: Invalid input
 */
dealRouter.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dealService.createDeal(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /deal/all:
 *   get:
 *     summary: Get all deals
 *     tags: [Deals]
 *     responses:
 *       200:
 *         description: List of all deals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 deals:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Unique identifier of the deal
 *                       creatorEmail:
 *                         type: string
 *                         format: email
 *                         description: Email address of the deal creator
 *                       collectionName:
 *                         type: string
 *                         description: Name of the voucher collection
 *                       category:
 *                         type: string
 *                         nullable: true
 *                         description: Category of the deal (optional)
 *                       tradeable:
 *                         type: boolean
 *                         description: Whether the deal is tradeable
 *                       quantity:
 *                         type: integer
 *                         description: Total quantity of vouchers in the deal
 *                       quantityRemaining:
 *                         type: integer
 *                         description: Number of vouchers remaining (not yet claimed)
 *                       currency:
 *                         type: string
 *                         nullable: true
 *                         description: Currency code (e.g., USD, EUR, NGN) - optional
 *                       country:
 *                         type: string
 *                         nullable: true
 *                         description: Country where the deal is available - optional
 *                       collectionAddress:
 *                         type: string
 *                         description: Public key address of the voucher collection
 *                       collectionDetails:
 *                         type: object
 *                         nullable: true
 *                         description: Full collection details from blockchain
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           image:
 *                             type: string
 *                           attributes:
 *                             type: object
 *                             properties:
 *                               merchant:
 *                                 type: string
 *                               collectionType:
 *                                 type: string
 *                               status:
 *                                 type: string
 *                               voucherTypes:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           metadata:
 *                             type: object
 *                             properties:
 *                               merchantName:
 *                                 type: string
 *                               merchantAddress:
 *                                 type: string
 *                               voucherTypes:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                           voucherStats:
 *                             type: object
 *                             properties:
 *                               totalVouchersIssued:
 *                                 type: integer
 *                               totalVouchersRedeemed:
 *                                 type: integer
 *                               totalValueRedeemed:
 *                                 type: number
 *                           creator:
 *                             type: string
 *                           owner:
 *                             type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp when the deal was created
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp when the deal was last updated
 */
dealRouter.get('/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dealService.getAllDeals();
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /deal/user/{email}:
 *   get:
 *     summary: Get all deals created by a specific user
 *     tags: [Deals]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: Email address of the creator
 *     responses:
 *       200:
 *         description: List of deals created by the user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 deals:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Unique identifier of the deal
 *                       creatorEmail:
 *                         type: string
 *                         format: email
 *                         description: Email address of the deal creator
 *                       collectionName:
 *                         type: string
 *                         description: Name of the voucher collection
 *                       category:
 *                         type: string
 *                         nullable: true
 *                         description: Category of the deal (optional)
 *                       tradeable:
 *                         type: boolean
 *                         description: Whether the deal is tradeable
 *                       quantity:
 *                         type: integer
 *                         description: Total quantity of vouchers in the deal
 *                       quantityRemaining:
 *                         type: integer
 *                         description: Number of vouchers remaining (not yet claimed)
 *                       currency:
 *                         type: string
 *                         nullable: true
 *                         description: Currency code (e.g., USD, EUR, NGN) - optional
 *                       country:
 *                         type: string
 *                         nullable: true
 *                         description: Country where the deal is available - optional
 *                       collectionAddress:
 *                         type: string
 *                         description: Public key address of the voucher collection
 *                       claimCodes:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Array of all claim codes for this deal (claimed and unclaimed)
 *                       claimedVouchers:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             claimCode:
 *                               type: string
 *                               description: Claim code used
 *                             voucherAddress:
 *                               type: string
 *                               description: Public key address of the claimed voucher
 *                             recipientEmail:
 *                               type: string
 *                               format: email
 *                               description: Email of the user who claimed the voucher
 *                             claimedAt:
 *                               type: string
 *                               format: date-time
 *                               description: When the voucher was claimed
 *                         description: Array of claimed vouchers with recipient details
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp when the deal was created
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp when the deal was last updated
 *       400:
 *         description: Invalid input or user not found
 */
dealRouter.get('/user/:email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dealService.getDealsByUser(req.params.email);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /deal/user/{email}/claimed:
 *   get:
 *     summary: Get all vouchers claimed by a specific user (vouchers they own)
 *     tags: [Deals]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: Email address of the user who claimed the vouchers
 *     responses:
 *       200:
 *         description: List of vouchers claimed by the user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 vouchers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       voucherAddress:
 *                         type: string
 *                         description: Public key address of the voucher
 *                       claimCode:
 *                         type: string
 *                         description: Claim code used to claim this voucher
 *                       claimedAt:
 *                         type: string
 *                         format: date-time
 *                         description: When the voucher was claimed
 *                       dealId:
 *                         type: string
 *                         description: ID of the deal this voucher belongs to
 *                       collectionAddress:
 *                         type: string
 *                         description: Public key address of the voucher collection
 *                       collectionName:
 *                         type: string
 *                         description: Name of the collection
 *                       category:
 *                         type: string
 *                         description: Category of the deal
 *                       tradeable:
 *                         type: boolean
 *                         description: Whether the deal/voucher is tradeable
 *                       country:
 *                         type: string
 *                         description: Country where the deal is available
 *                       currency:
 *                         type: string
 *                         description: Currency code for the deal
 *                       voucherDetails:
 *                         type: object
 *                         description: Full voucher details from blockchain (preferred source for voucher info)
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           image:
 *                             type: string
 *                           symbol:
 *                             type: string
 *                           assetName:
 *                             type: string
 *                           assetSymbol:
 *                             type: string
 *                           tokenAddress:
 *                             type: string
 *                           isExpired:
 *                             type: boolean
 *                           canRedeem:
 *                             type: boolean
 *                           type:
 *                             type: string
 *                           value:
 *                             type: number
 *                           remainingWorth:
 *                             type: number
 *                           status:
 *                             type: string
 *                           maxUses:
 *                             type: integer
 *                           currentUses:
 *                             type: integer
 *                           expiryDate:
 *                             type: integer
 *                           transferable:
 *                             type: boolean
 *                           redemptionHistory:
 *                             type: array
 *                       collectionDetails:
 *                         type: object
 *                         description: Full collection details from blockchain
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           image:
 *                             type: string
 *                           attributes:
 *                             type: object
 *                           metadata:
 *                             type: object
 *                           voucherStats:
 *                             type: object
 *       400:
 *         description: Invalid input or user not found
 */
dealRouter.get('/user/:email/claimed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dealService.getDealsClaimedByUser(req.params.email);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /deal/collection/{collectionAddress}/vouchers:
 *   get:
 *     summary: Get all vouchers (claimed and unclaimed) for a deal collection
 *     tags: [Deals]
 *     parameters:
 *       - in: path
 *         name: collectionAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: Public key address of the voucher collection
 *     responses:
 *       200:
 *         description: List of all vouchers with claim status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 vouchers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       claimCode:
 *                         type: string
 *                         description: Claim code for the voucher
 *                       voucherName:
 *                         type: string
 *                         description: Name of the voucher
 *                       voucherType:
 *                         type: string
 *                         description: Type of voucher
 *                       voucherWorth:
 *                         type: number
 *                         description: Worth/value of the voucher
 *                       currency:
 *                         type: string
 *                         description: Currency code
 *                       description:
 *                         type: string
 *                         description: Description of the voucher
 *                       expiryDate:
 *                         type: string
 *                         format: date-time
 *                         description: Expiry date of the voucher
 *                       maxUses:
 *                         type: integer
 *                         description: Maximum number of uses
 *                       transferable:
 *                         type: boolean
 *                         description: Whether the voucher is transferable
 *                       conditions:
 *                         type: string
 *                         description: Conditions for using the voucher
 *                       status:
 *                         type: string
 *                         enum: [claimed, unclaimed]
 *                         description: Claim status of the voucher
 *                       voucherAddress:
 *                         type: string
 *                         nullable: true
 *                         description: Voucher address (only present if claimed)
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: When the claim link was created
 *       400:
 *         description: Invalid input or collection not found
 */
dealRouter.get('/collection/:collectionAddress/vouchers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dealService.getCollectionVouchers(req.params.collectionAddress);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});
