import { Router, Request, Response, NextFunction } from 'express';
import * as voucherService from '../services/voucherService';

export const voucherRouter: Router = Router();

/**
 * @swagger
 * /voucher/create:
 *   post:
 *     summary: Create a loyalty card/voucher collection
 *     tags: [Loyalty Cards and Vouchers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - creatorEmail
 *               - voucherCollectionName
 *               - merchantName
 *               - merchantAddress
 *               - voucherTypes
 *               - imageURL
 *             properties:
 *               creatorEmail:
 *                 type: string
 *                 format: email
 *                 example: "merchant@example.com"
 *                 description: Email address of the creator (must be a registered Verxio user)
 *               voucherCollectionName:
 *                 type: string
 *                 example: "Summer Sale Vouchers"
 *               merchantName:
 *                 type: string
 *                 example: "Acme Store"
 *               merchantAddress:
 *                 type: string
 *                 example: "123 Main St, City, State"
 *               contactInfo:
 *                 type: string
 *                 example: "contact@acmestore.com"
 *               voucherTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["PERCENTAGE_OFF", "FIXED_VERXIO_CREDITS"]
 *               description:
 *                 type: string
 *                 example: "Collection of summer sale vouchers"
 *               imageURL:
 *                 type: string
 *                 format: uri
 *                 description: Required. Image URL used to automatically generate metadata. The generated metadataUri will be stored in the collection for reuse when minting vouchers.
 *                 example: "https://gateway.pinata.cloud/ipfs/Qm..."
 *               metadataUri:
 *                 type: string
 *                 format: uri
 *                 description: Optional. If provided, this will be used instead of auto-generating from imageURL. If not provided, metadata will be automatically generated from imageURL and stored.
 *                 example: "https://example.com/voucher-metadata.json"
 *           examples:
 *             example1:
 *               summary: Create voucher collection with imageURL (auto-generates metadata)
 *               value:
 *                 creatorEmail: "merchant@example.com"
 *                 voucherCollectionName: "Summer Sale Vouchers"
 *                 merchantName: "Acme Store"
 *                 merchantAddress: "123 Main St, City, State"
 *                 contactInfo: "contact@acmestore.com"
 *                 voucherTypes: ["PERCENTAGE_OFF", "FIXED_VERXIO_CREDITS"]
 *                 description: "Collection of summer sale vouchers"
 *                 imageURL: "https://gateway.pinata.cloud/ipfs/Qm..."
 *             example2:
 *               summary: Create voucher collection with custom metadataUri
 *               value:
 *                 creatorEmail: "merchant@example.com"
 *                 voucherCollectionName: "Summer Sale Vouchers"
 *                 merchantName: "Acme Store"
 *                 merchantAddress: "123 Main St, City, State"
 *                 contactInfo: "contact@acmestore.com"
 *                 voucherTypes: ["PERCENTAGE_OFF", "FIXED_VERXIO_CREDITS"]
 *                 description: "Collection of summer sale vouchers"
 *                 imageURL: "https://gateway.pinata.cloud/ipfs/Qm..."
 *                 metadataUri: "https://example.com/voucher-metadata.json"
 *     responses:
 *       201:
 *         description: Loyalty card/voucher collection created successfully
 *       400:
 *         description: Invalid input
 */
voucherRouter.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Map imageURL from request to imageUri for service
    const body = { ...req.body };
    if (body.imageURL) {
      body.imageUri = body.imageURL;
      delete body.imageURL;
    }
    const result = await voucherService.createVoucherCollection(body);
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
 * /voucher/mint:
 *   post:
 *     summary: Mint a loyalty card/voucher
 *     tags: [Loyalty Cards and Vouchers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - collectionAddress
 *               - recipientEmail
 *               - voucherName
 *               - voucherType
 *               - value
 *               - description
 *               - expiryDate
 *               - maxUses
 *               - merchantId
 *               - creatorEmail
 *             properties:
 *               collectionAddress:
 *                 type: string
 *                 example: "5bBmb9XSQ6BWofv98V1qoxiz8Ecb226mMYf1EH..."
 *                 description: Public key address of the voucher collection
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *                 example: "customer@example.com"
 *                 description: Email address of the recipient (must be a registered Verxio user)
 *               voucherName:
 *                 type: string
 *                 example: "20% Off Summer Sale"
 *               voucherType:
 *                 type: string
 *                 enum: [PERCENTAGE_OFF, FIXED_VERXIO_CREDITS, FREE_ITEM, BUY_ONE_GET_ONE, CUSTOM_REWARD, TOKEN, LOYALTY_COIN, FIAT]
 *                 example: "PERCENTAGE_OFF"
 *               value:
 *                 type: number
 *                 example: 20
 *                 description: Value of the voucher (percentage, amount, etc.)
 *               description:
 *                 type: string
 *                 example: "Get 20% off on all summer items"
 *               expiryDate:
 *                 type: string
 *                 example: "25/12/2025"
 *                 description: Expiry date in DD/MM/YYYY format (e.g., 25/12/2025) or ISO 8601 format. Must be in the future.
 *               maxUses:
 *                 type: integer
 *                 example: 1
 *                 description: Maximum number of times the voucher can be used
 *               transferable:
 *                 type: boolean
 *                 example: true
 *                 default: true
 *               merchantId:
 *                 type: string
 *                 example: "merchant123"
 *               conditions:
 *                 type: string
 *                 example: "Minimum purchase of $50"
 *                 description: Optional. Conditions or terms for using this voucher (e.g., "Minimum purchase of $50", "Valid only on weekends")
 *               voucherMetadataUri:
 *                 type: string
 *                 format: uri
 *                 example: "https://example.com/voucher-metadata.json"
 *                 description: "Optional. Priority: 1) Provided voucherMetadataUri, 2) Collection's stored metadataUri, 3) Auto-generated from imageURL. The collection must have a stored metadataUri from creation to use option 2."
 *               imageURL:
 *                 type: string
 *                 format: uri
 *                 example: "https://gateway.pinata.cloud/ipfs/Qm..."
 *                 description: "Optional. Used to auto-generate metadata only if voucherMetadataUri is not provided AND collection has no stored metadataUri"
 *               creatorEmail:
 *                 type: string
 *                 format: email
 *                 example: "merchant@example.com"
 *                 description: Email address of the creator (must be a registered Verxio user)
 *           examples:
 *             example1:
 *               summary: Mint voucher (uses collection's stored metadata URI)
 *               value:
 *                 collectionAddress: "5bBmb9XSQ6BWofv98V1qoxiz8Ecb226mMYf1....."
 *                 recipientEmail: "customer@example.com"
 *                 voucherName: "20% Off Summer Sale"
 *                 voucherType: "PERCENTAGE_OFF"
 *                 value: 20
 *                 description: "Get 20% off on all summer items"
 *                 expiryDate: "25/12/2025"
 *                 maxUses: 1
 *                 transferable: true
 *                 merchantId: "merchant123"
 *                 conditions: "Minimum purchase of $50"
 *                 creatorEmail: "merchant@example.com"
 *             example2:
 *               summary: Mint voucher without conditions (conditions are optional)
 *               value:
 *                 collectionAddress: "5bBmb9XSQ6BWofv98V1qoxiz8Ecb226mMYf1....."
 *                 recipientEmail: "customer@example.com"
 *                 voucherName: "20% Off Summer Sale"
 *                 voucherType: "PERCENTAGE_OFF"
 *                 value: 20
 *                 description: "Get 20% off on all summer items"
 *                 expiryDate: "25/12/2025"
 *                 maxUses: 1
 *                 transferable: true
 *                 merchantId: "merchant123"
 *                 creatorEmail: "merchant@example.com"
 *     responses:
 *       201:
 *         description: Loyalty card/voucher minted successfully
 */
voucherRouter.post('/mint', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creatorEmail, ...voucherData } = req.body;
    const result = await voucherService.mintVoucher(voucherData, creatorEmail);
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
 * /voucher/validate:
 *   post:
 *     summary: Validate a loyalty card/voucher
 *     tags: [Loyalty Cards and Vouchers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - voucherAddress
 *               - creatorEmail
 *             properties:
 *               voucherAddress:
 *                 type: string
 *                 example: "7xKXtg2CZ3QvF3j..."
 *                 description: Public key address of the voucher to validate
 *               creatorEmail:
 *                 type: string
 *                 format: email
 *                 example: "merchant@example.com"
 *                 description: Email address of the creator (must be a registered Verxio user)
 *           examples:
 *             example1:
 *               summary: Validate voucher
 *               value:
 *                 voucherAddress: "7xKXtg2CZ3QvF3j..."
 *                 creatorEmail: "merchant@example.com"
 *     responses:
 *       200:
 *         description: Loyalty card/voucher validation result
 */
voucherRouter.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { voucherAddress, creatorEmail } = req.body;
    const result = await voucherService.validateVoucher(voucherAddress, creatorEmail);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /voucher/redeem:
 *   post:
 *     summary: Redeem a loyalty card/voucher
 *     tags: [Loyalty Cards and Vouchers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - voucherAddress
 *               - merchantId
 *               - creatorEmail
 *             properties:
 *               voucherAddress:
 *                 type: string
 *                 example: "7xKXtg2CZ3QvF3j..."
 *                 description: Public key address of the voucher to redeem
 *               merchantId:
 *                 type: string
 *               creatorEmail:
 *                 type: string
 *                 format: email
 *               redemptionAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Loyalty card/voucher redeemed successfully
 */
voucherRouter.post('/redeem', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { voucherAddress, merchantId, creatorEmail, redemptionAmount } = req.body;
    const result = await voucherService.redeemVoucher(voucherAddress, merchantId, creatorEmail, redemptionAmount);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /voucher/cancel:
 *   post:
 *     summary: Cancel a loyalty card/voucher
 *     tags: [Loyalty Cards and Vouchers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - voucherAddress
 *               - reason
 *               - creatorEmail
 *             properties:
 *               voucherAddress:
 *                 type: string
 *                 example: "7xKXtg2CZ3QvF3j..."
 *                 description: Public key address of the voucher to cancel
 *               reason:
 *                 type: string
 *                 example: "Customer requested cancellation"
 *                 description: Reason for cancelling the voucher
 *               creatorEmail:
 *                 type: string
 *                 format: email
 *                 example: "merchant@example.com"
 *                 description: Email address of the creator (must be a registered Verxio user)
 *           examples:
 *             example1:
 *               summary: Cancel voucher
 *               value:
 *                 voucherAddress: "7xKXtg2CZ3QvF3j..."
 *                 reason: "Customer requested cancellation"
 *                 creatorEmail: "merchant@example.com"
 *     responses:
 *       200:
 *         description: Loyalty card/voucher cancelled successfully
 */
voucherRouter.post('/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { voucherAddress, reason, creatorEmail } = req.body;
    const result = await voucherService.cancelVoucher(voucherAddress, reason, creatorEmail);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /voucher/extend-expiry:
 *   post:
 *     summary: Extend loyalty card/voucher expiry date
 *     tags: [Loyalty Cards and Vouchers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - voucherAddress
 *               - newExpiryDate
 *               - creatorEmail
 *             properties:
 *               voucherAddress:
 *                 type: string
 *                 example: "7xKXtg2CZ3QvF3j..."
 *                 description: Public key address of the voucher to extend
 *               newExpiryDate:
 *                 type: string
 *                 example: "25/12/2025"
 *                 description: New expiry date in DD/MM/YYYY format (e.g., 25/12/2025) or ISO 8601 format. Must be in the future.
 *               creatorEmail:
 *                 type: string
 *                 format: email
 *                 example: "merchant@example.com"
 *                 description: Email address of the creator (must be a registered Verxio user)
 *           examples:
 *             example1:
 *               summary: Extend voucher expiry
 *               value:
 *                 voucherAddress: "7xKXtg2CZ3QvF3j..."
 *                 newExpiryDate: "25/12/2025"
 *                 creatorEmail: "merchant@example.com"
 *     responses:
 *       200:
 *         description: Loyalty card/voucher expiry extended successfully
 */
voucherRouter.post('/extend-expiry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { voucherAddress, newExpiryDate, creatorEmail } = req.body;
    const result = await voucherService.extendVoucherExpiry(voucherAddress, newExpiryDate, creatorEmail);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /voucher/collections:
 *   get:
 *     summary: Get user loyalty card/voucher collections
 *     tags: [Loyalty Cards and Vouchers]
 *     parameters:
 *       - in: query
 *         name: creatorEmail
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Loyalty card/voucher collections retrieved successfully
 */
voucherRouter.get('/collections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creatorEmail, page = '1', limit = '10' } = req.query;
    const result = await voucherService.getUserVoucherCollections(
      creatorEmail as string,
      parseInt(page as string),
      parseInt(limit as string)
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /voucher/collection/{collectionAddress}:
 *   get:
 *     summary: Get loyalty card/voucher collection by address
 *     tags: [Loyalty Cards and Vouchers]
 *     parameters:
 *       - in: path
 *         name: collectionAddress
 *         required: true
 *         schema:
 *           type: string
 *         example: "5bBmb9XSQ6BWofv98V1qoxiz8Ecb226mMYf1EH..."
 *         description: Public key address of the voucher collection
 *       - in: query
 *         name: creatorEmail
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         example: "merchant@example.com"
 *         description: Email address of the creator (must be a registered Verxio user)
 *     responses:
 *       200:
 *         description: Loyalty card/voucher collection retrieved successfully
 *       404:
 *         description: Loyalty card/voucher collection not found
 */
voucherRouter.get('/collection/:collectionAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionAddress } = req.params;
    const { creatorEmail } = req.query;
    const result = await voucherService.getVoucherCollectionByPublicKey(collectionAddress, creatorEmail as string);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /voucher/details:
 *   get:
 *     summary: Get loyalty card/voucher details
 *     tags: [Loyalty Cards and Vouchers]
 *     parameters:
 *       - in: query
 *         name: voucherAddress
 *         required: true
 *         schema:
 *           type: string
 *         example: "7xKXtg2CZ3QvF3j..."
 *         description: Public key address of the voucher
 *     responses:
 *       200:
 *         description: Voucher details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     image:
 *                       type: string
 *                     symbol:
 *                       type: string
 *                     isExpired:
 *                       type: boolean
 *                     canRedeem:
 *                       type: boolean
 *                     attributes:
 *                       type: object
 *                     creator:
 *                       type: string
 *                     owner:
 *                       type: string
 *                     collectionId:
 *                       type: string
 *                     voucherData:
 *                       type: object
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Voucher not found
 */
voucherRouter.get('/details', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { voucherAddress } = req.query;
    
    if (!voucherAddress || typeof voucherAddress !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Voucher address is required',
      });
    }

    const result = await voucherService.getVoucherDetailsByAddress(voucherAddress);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /voucher/collection/authority/{collectionAddress}:
 *   get:
 *     summary: Get loyalty card/voucher collection authority secret key
 *     tags: [Loyalty Cards and Vouchers]
 *     parameters:
 *       - in: path
 *         name: collectionAddress
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Authority secret key retrieved successfully
 */
voucherRouter.get('/collection/authority/:collectionAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionAddress } = req.params;
    const result = await voucherService.getVoucherAuthoritySecretKey(collectionAddress);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /voucher/secret-key/{voucherAddress}:
 *   get:
 *     summary: Get loyalty card/voucher secret key
 *     tags: [Loyalty Cards and Vouchers]
 *     parameters:
 *       - in: path
 *         name: voucherAddress
 *         required: true
 *         schema:
 *           type: string
 *         example: "7xKXtg2CZ3QvF3j..."
 *         description: Public key address of the voucher
 *       - in: query
 *         name: creatorEmail
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         example: "merchant@example.com"
 *         description: Email address of the creator (must be a registered Verxio user)
 *     responses:
 *       200:
 *         description: Loyalty card/voucher secret key retrieved successfully
 */
voucherRouter.get('/secret-key/:voucherAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { voucherAddress } = req.params;
    const { creatorEmail } = req.query;
    const result = await voucherService.getVoucherSecretKey(voucherAddress, creatorEmail as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /voucher/user:
 *   get:
 *     summary: Get user loyalty cards/vouchers
 *     tags: [Loyalty Cards and Vouchers]
 *     parameters:
 *       - in: query
 *         name: userEmail
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         example: "customer@example.com"
 *         description: Email address of the user (must be a registered Verxio user)
 *       - in: query
 *         name: collectionAddress
 *         schema:
 *           type: string
 *         example: "7xKXtg2CZ3QvF3j..."
 *         description: Optional collection address to filter vouchers
 *     responses:
 *       200:
 *         description: User loyalty cards/vouchers retrieved successfully
 */
voucherRouter.get('/user', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userEmail, collectionAddress } = req.query;
    const result = await voucherService.getUserVouchers(userEmail as string, collectionAddress as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

