"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { z } from "zod/v3";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Ticket } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";

// Available actions for loyalty deal node
export const LOYALTY_DEAL_ACTIONS = [
  { value: "get_stats", label: "Get Merchant Stats" },
  { value: "get_recent_activity", label: "Get Recent Activity" },
  { value: "get_deals", label: "Get Deals" },
  { value: "create_deal", label: "Create Deal" },
  { value: "lookup_voucher", label: "Lookup Voucher" },
  { value: "add_quantity", label: "Add Quantity to Deal" },
  { value: "extend_expiry", label: "Extend Deal Expiry" },
] as const;

// Voucher types
export const VOUCHER_TYPES = [
  { value: "PERCENTAGE_OFF", label: "Percentage Off" },
  { value: "FIXED_AMOUNT_OFF", label: "Fixed Amount Off" },
  { value: "BUY_ONE_GET_ONE", label: "Buy One Get One" },
  { value: "FREE_ITEM", label: "Free Item" },
  { value: "FREE_SHIPPING", label: "Free Shipping" },
  { value: "CUSTOM_REWARD", label: "Custom Reward" },
] as const;

const ACTION_VALUES = LOYALTY_DEAL_ACTIONS.map((a) => a.value) as [string, ...string[]];

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message: "Variable name must start with a letter or underscore",
    }),
  action: z.enum(ACTION_VALUES),
  userEmail: z.string().optional(),
  limit: z.number().optional(),
  // Create deal fields
  collectionName: z.string().optional(),
  merchantName: z.string().optional(),
  merchantAddress: z.string().optional(),
  merchantWebsite: z.string().optional(),
  contactEmail: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  imageURL: z.string().optional(),
  voucherName: z.string().optional(),
  voucherType: z.string().optional(),
  voucherWorth: z.number().optional(),
  currencyCode: z.string().optional(),
  country: z.string().optional(),
  quantity: z.number().optional(),
  expiryDate: z.string().optional(),
  maxUses: z.number().optional(),
  tradeable: z.boolean().optional(),
  transferable: z.boolean().optional(),
  conditions: z.string().optional(),
  // Lookup/modify fields
  claimCode: z.string().optional(),
  dealId: z.string().optional(),
  newExpiryDate: z.string().optional(),
});

export type LoyaltyDealFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LoyaltyDealFormValues) => void;
  defaultValues?: Partial<LoyaltyDealFormValues>;
}

export const LoyaltyDealDialog = ({ open, onOpenChange, onSubmit, defaultValues = {} }: Props) => {
  const form = useForm<LoyaltyDealFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "loyaltyDeal",
      action: defaultValues.action || "get_stats",
      userEmail: defaultValues.userEmail || "",
      limit: defaultValues.limit || 10,
      collectionName: defaultValues.collectionName || "",
      merchantName: defaultValues.merchantName || "",
      merchantAddress: defaultValues.merchantAddress || "",
      voucherName: defaultValues.voucherName || "",
      voucherType: defaultValues.voucherType || "CUSTOM_REWARD",
      voucherWorth: defaultValues.voucherWorth || 0,
      quantity: defaultValues.quantity || 1,
      expiryDate: defaultValues.expiryDate || "",
      maxUses: defaultValues.maxUses || 1,
      tradeable: defaultValues.tradeable || false,
      claimCode: defaultValues.claimCode || "",
      dealId: defaultValues.dealId || "",
      newExpiryDate: defaultValues.newExpiryDate || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "loyaltyDeal",
        action: defaultValues.action || "get_stats",
        userEmail: defaultValues.userEmail || "",
        limit: defaultValues.limit || 10,
        ...defaultValues,
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "loyaltyDeal";
  const watchAction = form.watch("action");

  const handleSubmit = async (values: LoyaltyDealFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Loyalty Deal node configured");
      form.reset();
    } catch (error) {
      // Error handling in parent
    }
  };

  // Helper to render action-specific fields
  const renderActionFields = () => {
    switch (watchAction) {
      case "get_stats":
      case "get_deals":
        return (
          <FormField
            control={form.control}
            name="userEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>User Email</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="{{user.email}}" />
                </FormControl>
                <FormDescription>Email of the merchant to get stats/deals for</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "get_recent_activity":
        return (
          <>
            <FormField
              control={form.control}
              name="userEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Email</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{user.email}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Limit</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                    />
                  </FormControl>
                  <FormDescription>Number of activities to fetch</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "create_deal":
        return (
          <>
            <FormField
              control={form.control}
              name="userEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Creator Email</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{user.email}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="collectionName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Summer Sale Collection" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="merchantName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Merchant Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Acme Store" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="merchantAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Merchant Address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="123 Main St, City" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="voucherName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voucher Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="20% Off Summer Sale" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="voucherType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voucher Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VOUCHER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="voucherWorth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Worth/Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="expiryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "lookup_voucher":
        return (
          <>
            <FormField
              control={form.control}
              name="userEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Merchant Email</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{user.email}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="claimCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Claim Code</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{voucher.claimCode}}" />
                  </FormControl>
                  <FormDescription>The voucher claim code to lookup</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "add_quantity":
        return (
          <>
            <FormField
              control={form.control}
              name="userEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Creator Email</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{user.email}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dealId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{deal.id}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Add</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "extend_expiry":
        return (
          <>
            <FormField
              control={form.control}
              name="userEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Creator Email</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{user.email}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dealId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{deal.id}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newExpiryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Expiry Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-orange-500" />
            Loyalty Deal
          </DialogTitle>
          <DialogDescription>Manage loyalty deals and vouchers.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2 -mr-2">
              <FormField
                control={form.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variable Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="loyaltyDeal" />
                    </FormControl>
                    <FormDescription>
                      Access results via: <code>{`{{${watchVariables}.success}}`}</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LOYALTY_DEAL_ACTIONS.map((action) => (
                          <SelectItem key={action.value} value={action.value}>
                            {action.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {renderActionFields()}
            </div>
            <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
