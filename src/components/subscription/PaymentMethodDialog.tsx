import { useState } from 'react';
import { CreditCard, Smartphone, Wallet, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface PaymentMethod {
  id: 'stripe' | 'paypal' | 'mpesa';
  name: string;
  icon: React.ReactNode;
  description: string;
}

const paymentMethods: PaymentMethod[] = [
  {
    id: 'stripe',
    name: 'Card Payment',
    icon: <CreditCard className="w-6 h-6" />,
    description: 'Pay with credit or debit card via Stripe',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    icon: <Wallet className="w-6 h-6" />,
    description: 'Pay securely with your PayPal account',
  },
  {
    id: 'mpesa',
    name: 'M-Pesa',
    icon: <Smartphone className="w-6 h-6" />,
    description: 'Pay via M-Pesa mobile money',
  },
];

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  planPrice: number;
  onSelectMethod: (method: 'stripe' | 'paypal' | 'mpesa') => void;
  processingMethod: string | null;
  configuredMethods: {
    stripe: boolean;
    paypal: boolean;
    mpesa: boolean;
  };
}

export function PaymentMethodDialog({
  open,
  onOpenChange,
  planName,
  planPrice,
  onSelectMethod,
  processingMethod,
  configuredMethods,
}: PaymentMethodDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'paypal' | 'mpesa' | null>(null);

  const handleProceed = () => {
    if (selectedMethod) {
      onSelectMethod(selectedMethod);
    }
  };

  const isMethodConfigured = (methodId: 'stripe' | 'paypal' | 'mpesa') => {
    return configuredMethods[methodId];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Choose Payment Method</DialogTitle>
          <DialogDescription className="text-center">
            Subscribe to <span className="font-semibold text-foreground">{planName}</span> for{' '}
            <span className="font-semibold text-foreground">${planPrice}/month</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {paymentMethods.map((method) => {
            const isConfigured = isMethodConfigured(method.id);
            const isSelected = selectedMethod === method.id;
            const isProcessing = processingMethod === method.id;

            return (
              <button
                key={method.id}
                onClick={() => {
                  if (isConfigured && !processingMethod) {
                    setSelectedMethod(method.id);
                  }
                }}
                disabled={!isConfigured || !!processingMethod}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left",
                  isSelected && isConfigured
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30",
                  !isConfigured && "opacity-50 cursor-not-allowed bg-muted/30"
                )}
              >
                <div className={cn(
                  "p-2 rounded-full",
                  isSelected && isConfigured ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {method.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{method.name}</p>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </div>
                {!isConfigured && (
                  <span className="text-xs text-destructive font-medium">Not Available</span>
                )}
                {isProcessing && (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                )}
              </button>
            );
          })}
        </div>

        {selectedMethod && !isMethodConfigured(selectedMethod) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This payment method is not configured. Please choose another option.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={!!processingMethod}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleProceed}
            disabled={!selectedMethod || !isMethodConfigured(selectedMethod!) || !!processingMethod}
          >
            {processingMethod ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Continue to Payment'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
