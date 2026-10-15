import React from 'react';
import { AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { DetectedObstacle } from '../types';

interface CameraObstacleOverlayProps {
  obstacles: DetectedObstacle[];
  onSelectObstacle?: (obs: DetectedObstacle) => void;
  isScanning: boolean;
}

export const CameraObstacleOverlay: React.FC<CameraObstacleOverlayProps> = ({
  obstacles,
  onSelectObstacle,
  isScanning,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Scanning radar sweep animation when scanning */}
      {isScanning && (
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/0 via-indigo-500/20 to-indigo-500/0 animate-pulse pointer-events-none" />
      )}

      {/* Render detected rectangle bounding boxes */}
      {obstacles.map((obs) => {
        if (!obs.box2d || obs.box2d.length !== 4) return null;

        const [ymin, xmin, ymax, xmax] = obs.box2d;

        // Convert 0-1000 scale to percentage
        const top = Math.max(0, Math.min(100, ymin / 10));
        const left = Math.max(0, Math.min(100, xmin / 10));
        const height = Math.max(4, Math.min(100 - top, (ymax - ymin) / 10));
        const width = Math.max(6, Math.min(100 - left, (xmax - xmin) / 10));

        const isHazard = obs.isHazard || obs.severity === 'high';
        const isMedium = obs.severity === 'medium';

        const borderColor = isHazard
          ? 'border-rose-500 shadow-rose-500/50'
          : isMedium
          ? 'border-amber-400 shadow-amber-400/50'
          : 'border-cyan-400 shadow-cyan-400/50';

        const bgColor = isHazard
          ? 'bg-rose-500/15'
          : isMedium
          ? 'bg-amber-500/15'
          : 'bg-cyan-500/15';

        const badgeColor = isHazard
          ? 'bg-rose-600 text-white'
          : isMedium
          ? 'bg-amber-500 text-slate-950 font-bold'
          : 'bg-cyan-600 text-white';

        return (
          <div
            key={obs.id}
            onClick={() => onSelectObstacle?.(obs)}
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${width}%`,
              height: `${height}%`,
            }}
            className={`absolute border-2 rounded-xl transition-all duration-300 pointer-events-auto cursor-pointer group shadow-lg ${borderColor} ${bgColor}`}
          >
            {/* Top decorative corner markers */}
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-white rounded-tl" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-white rounded-tr" />
            <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-white rounded-bl" />
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-white rounded-br" />

            {/* Label Badge on top of bounding box */}
            <div className="absolute -top-7 left-0 flex items-center gap-1.5 shadow-md">
              <span
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 uppercase tracking-wider backdrop-blur-md ${badgeColor}`}
              >
                {isHazard ? (
                  <AlertTriangle className="w-3 h-3 text-white" />
                ) : isMedium ? (
                  <Info className="w-3 h-3 text-slate-950" />
                ) : (
                  <ShieldCheck className="w-3 h-3 text-white" />
                )}
                <span>{obs.label}</span>
                {obs.distance && (
                  <span className="opacity-90 font-mono text-[10px] lowercase">
                    • {obs.distance}
                  </span>
                )}
              </span>
            </div>

            {/* Distance / Location pill at bottom of box if present */}
            {obs.location && (
              <div className="absolute -bottom-5 right-0">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/80 text-white border border-white/20">
                  {obs.location}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
