
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Link2, Loader2, ArrowRight, ArrowLeft, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useZoomIntegration } from '@/hooks/useZoomIntegration';
import { supabase } from '@/integrations/supabase/client';

const credentialsSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client Secret is required'),
  accountId: z.string().min(1, 'Account ID is required'),
});

type CredentialsForm = z.infer<typeof credentialsSchema>;

interface ZoomConnectionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type WizardStep = 'welcome' | 'credentials' | 'connecting' | 'success';

const ZoomConnectionWizard = ({ isOpen, onClose, onSuccess }: ZoomConnectionWizardProps) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const { initializeZoomOAuth } = useZoomIntegration();
  
  const form = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      clientId: '',
      clientSecret: '',
      accountId: '',
    },
  });

  const getStepNumber = (step: WizardStep): number => {
    const steps = { welcome: 1, credentials: 2, connecting: 3, success: 4 };
    return steps[step];
  };

  const getProgress = (): number => {
    return (getStepNumber(currentStep) / 4) * 100;
  };

  const handleNext = () => {
    if (currentStep === 'welcome') {
      setCurrentStep('credentials');
    }
  };

  const handleBack = () => {
    if (currentStep === 'credentials') {
      setCurrentStep('welcome');
    }
  };

  const handleCredentialsSubmit = async (data: CredentialsForm) => {
    setIsLoading(true);
    setCurrentStep('connecting');
    
    try {
      // Store credentials using the new edge function
      const { data: storeResponse, error: storeError } = await supabase.functions.invoke('zoom-store-credentials', {
        body: {
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          accountId: data.accountId,
        }
      });

      if (storeError) {
        throw new Error(storeError.message);
      }

      if (!storeResponse?.success) {
        throw new Error('Failed to store credentials');
      }

      // Wait a moment for credentials to be stored
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Start OAuth flow
      await initializeZoomOAuth();
      
      setCurrentStep('success');
      
      toast({
        title: "Connection Successful",
        description: "Your Zoom credentials have been stored and connection initiated.",
      });
      
      // Auto-redirect after 3 seconds
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 3000);
      
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to Zoom. Please check your credentials and try again.",
        variant: "destructive",
      });
      setCurrentStep('credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      form.reset();
      setCurrentStep('welcome');
      onClose();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Link2 className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Connect to Zoom</h3>
              <p className="text-gray-600 mb-4">
                Integrate your Zoom account to automatically sync webinar data, attendee information, 
                and engagement metrics to your dashboard.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg text-left">
                <h4 className="font-medium text-sm mb-2">What you'll get:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Automatic webinar data synchronization</li>
                  <li>• Real-time attendee tracking</li>
                  <li>• Engagement analytics and insights</li>
                  <li>• Chat and Q&A integration</li>
                </ul>
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg text-left">
              <p className="text-sm text-blue-800">
                <strong>One-time setup:</strong> Your API credentials will be securely encrypted and stored 
                for future use. You'll only need to enter them once.
              </p>
            </div>
          </div>
        );

      case 'credentials':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Enter API Credentials</h3>
              <p className="text-gray-600">
                Enter your Zoom API credentials. They will be securely encrypted and stored.
              </p>
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCredentialsSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your Zoom Client ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="clientSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Secret</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter your Zoom Client Secret" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your Zoom Account ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
            
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-start space-x-2">
                <ExternalLink className="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-800">
                    <strong>Need API credentials?</strong> Create a Server-to-Server OAuth app in the Zoom Marketplace 
                    to get your Client ID, Secret, and Account ID.
                  </p>
                  <a 
                    href="https://marketplace.zoom.us/develop/create" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Go to Zoom Marketplace →
                  </a>
                </div>
              </div>
            </div>
          </div>
        );

      case 'connecting':
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Connecting to Zoom</h3>
              <p className="text-gray-600">
                We're securely storing your credentials and setting up the connection...
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                <span>Encrypting and storing credentials</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-gray-300 rounded-full" />
                <span>Establishing OAuth connection</span>
              </div>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Successfully Connected!</h3>
              <p className="text-gray-600 mb-4">
                Your Zoom credentials have been securely stored and your account is now connected. 
                You can now sync your webinar data.
              </p>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Connection Active
              </Badge>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                Redirecting you to the account dashboard in a few seconds...
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderFooter = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleNext}>
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );

      case 'credentials':
        return (
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack} disabled={isLoading}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button 
              onClick={form.handleSubmit(handleCredentialsSubmit)} 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Storing...
                </>
              ) : (
                'Store & Connect'
              )}
            </Button>
          </div>
        );

      case 'connecting':
        return (
          <div className="flex justify-center">
            <Button disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </Button>
          </div>
        );

      case 'success':
        return (
          <div className="flex justify-center">
            <Button onClick={() => { onSuccess?.(); onClose(); }}>
              Go to Dashboard
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Zoom Integration Setup</span>
            <Badge variant="outline">{getStepNumber(currentStep)} of 4</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Progress value={getProgress()} className="w-full" />
          
          <div className="min-h-[400px]">
            {renderStepContent()}
          </div>
          
          {renderFooter()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ZoomConnectionWizard;
