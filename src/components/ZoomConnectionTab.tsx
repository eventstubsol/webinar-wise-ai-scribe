
import React from 'react';
import ZoomConnectionCard from './ZoomConnectionCard';
import ZoomConnectionWizard from './ZoomConnectionWizard';

interface ZoomConnectionTabProps {
  isConnected: boolean;
  zoomConnection: any;
}

const ZoomConnectionTab = ({ isConnected, zoomConnection }: ZoomConnectionTabProps) => {
  return (
    <div className="space-y-4">
      {!isConnected ? (
        <ZoomConnectionWizard 
          isOpen={true}
          onClose={() => {}}
        />
      ) : (
        <ZoomConnectionCard 
          zoomConnection={zoomConnection}
          isConnected={isConnected}
        />
      )}
    </div>
  );
};

export default ZoomConnectionTab;
