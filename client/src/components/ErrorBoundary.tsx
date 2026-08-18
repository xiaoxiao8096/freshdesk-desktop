import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import React, { Component, Fragment, ReactNode } from "react";

interface Props {
  children: ReactNode;
  onRecover?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  recoveryKey: number;
}

export function recoverDesktopState(current: ErrorBoundaryState): ErrorBoundaryState {
  return { hasError: false, error: null, recoveryKey: current.recoveryKey + 1 };
}

export class ErrorBoundary extends Component<Props, ErrorBoundaryState> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, recoveryKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  recoverDesktop = () => {
    this.props.onRecover?.();
    this.setState(recoverDesktopState);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-2">桌面遇到了一个可恢复的问题</h2>
            <p className="max-w-lg text-center text-sm text-muted-foreground mb-4">已保存在本机的桌面快照不会丢失。你可以先恢复桌面；仅在问题持续时再刷新整个应用。</p>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={this.recoverDesktop}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              从最近快照恢复桌面
            </button>
            <button onClick={() => window.location.reload()} className="mt-3 text-sm text-muted-foreground underline underline-offset-4">仍无法恢复时，刷新整个应用</button>
          </div>
        </div>
      );
    }

    return <Fragment key={this.state.recoveryKey}>{this.props.children}</Fragment>;
  }
}

export default ErrorBoundary;
