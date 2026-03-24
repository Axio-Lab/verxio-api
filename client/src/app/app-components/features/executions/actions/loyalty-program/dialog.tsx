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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Award } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect } from "react";

// Available actions for loyalty program node
export const LOYALTY_PROGRAM_ACTIONS = [
  { value: "get_programs", label: "Get Programs" },
  { value: "create_program", label: "Create Program" },
  { value: "get_total_members", label: "Get Total Members" },
  { value: "issue_pass", label: "Issue Pass" },
  { value: "get_program_details", label: "Get Program Details" },
  { value: "get_program_users", label: "Get Program Users" },
  { value: "gift_points", label: "Gift Points" },
  { value: "revoke_points", label: "Revoke Points" },
] as const;

const ACTION_VALUES = LOYALTY_PROGRAM_ACTIONS.map((a) => a.value) as [string, ...string[]];

const formSchema = z.object({
  variables: z
    .string()
    .min(1, { message: "Variable name is required" })
    .regex(/^[A-Za-z_$][A-Za-z0-9_]*$/, {
      message: "Variable name must start with a letter or underscore",
    }),
  action: z.enum(ACTION_VALUES),
  userEmail: z.string().optional(),
  // Create program fields
  programName: z.string().optional(),
  programDescription: z.string().optional(),
  programImageUrl: z.string().optional(),
  pointsPerAction: z.number().optional(),
  tiers: z.string().optional(),
  rewardTiers: z.string().optional(),
  // Issue pass / gift / revoke fields
  programAddress: z.string().optional(),
  recipientEmail: z.string().optional(),
  pointsToGift: z.number().optional(),
  pointsToRevoke: z.number().optional(),
  // Get program details
  collectionAddress: z.string().optional(),
});

export type LoyaltyProgramFormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LoyaltyProgramFormValues) => void;
  defaultValues?: Partial<LoyaltyProgramFormValues>;
}

export const LoyaltyProgramDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues = {},
}: Props) => {
  const form = useForm<LoyaltyProgramFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      variables: defaultValues.variables || "loyaltyProgram",
      action: defaultValues.action || "get_programs",
      userEmail: defaultValues.userEmail || "",
      programName: defaultValues.programName || "",
      programDescription: defaultValues.programDescription || "",
      pointsPerAction: defaultValues.pointsPerAction || 10,
      programAddress: defaultValues.programAddress || "",
      recipientEmail: defaultValues.recipientEmail || "",
      pointsToGift: defaultValues.pointsToGift || 0,
      pointsToRevoke: defaultValues.pointsToRevoke || 0,
      collectionAddress: defaultValues.collectionAddress || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        variables: defaultValues.variables || "loyaltyProgram",
        action: defaultValues.action || "get_programs",
        userEmail: defaultValues.userEmail || "",
        ...defaultValues,
      });
    }
  }, [open, defaultValues, form]);

  const watchVariables = form.watch("variables") || "loyaltyProgram";
  const watchAction = form.watch("action");

  const handleSubmit = async (values: LoyaltyProgramFormValues) => {
    try {
      await Promise.resolve(onSubmit(values));
      onOpenChange(false);
      toast.success("Loyalty Program node configured");
      form.reset();
    } catch (error) {
      // Error handling in parent
    }
  };

  // Helper to render action-specific fields
  const renderActionFields = () => {
    switch (watchAction) {
      case "get_programs":
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
                <FormDescription>Email of the user to get programs for</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "create_program":
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
              name="programName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="VIP Rewards Program" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="programDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Earn points on every purchase and unlock exclusive rewards"
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="programImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pointsPerAction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Points Per Action</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                    />
                  </FormControl>
                  <FormDescription>Default points earned per action</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "get_total_members":
        return (
          <>
            <FormField
              control={form.control}
              name="userEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Email (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{user.email}}" />
                  </FormControl>
                  <FormDescription>
                    If provided, gets members across all user's programs
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="programAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Address (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{program.address}}" />
                  </FormControl>
                  <FormDescription>Or specify a single program address</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "issue_pass":
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
                  <FormDescription>Program creator's email</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="programAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{program.address}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recipientEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Email</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{customer.email}}" />
                  </FormControl>
                  <FormDescription>Email of the person receiving the pass</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "get_program_details":
      case "get_program_users":
        return (
          <FormField
            control={form.control}
            name="collectionAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Collection/Program Address</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="{{program.address}}" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case "gift_points":
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
              name="programAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{program.address}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recipientEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Member Email</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{member.email}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pointsToGift"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Points to Gift</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );

      case "revoke_points":
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
              name="programAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{program.address}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recipientEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Member Email</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="{{member.email}}" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pointsToRevoke"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Points to Revoke</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
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
            <Award className="h-5 w-5 text-purple-500" />
            Loyalty Program
          </DialogTitle>
          <DialogDescription>Manage loyalty programs and member passes.</DialogDescription>
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
                      <Input {...field} placeholder="loyaltyProgram" />
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
                        {LOYALTY_PROGRAM_ACTIONS.map((action) => (
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
