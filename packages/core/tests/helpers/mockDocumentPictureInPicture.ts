export const mockDocumentPictureInPicture = () => {
  let pipWindow: any = null;

  const mockRequestWindow = async (options: any = {}) => {
    const win = {
      document: {
        body: document.createElement('body'),
        head: document.createElement('head'),
        documentElement: document.createElement('html'),
        createElement: (tag: string) => document.createElement(tag),
        querySelectorAll: (sel: string) => document.querySelectorAll(sel),
      },
      innerWidth: options.width || 900,
      innerHeight: options.height || 600,
      closed: false,
      close: function() {
        if (this.closed) return;
        this.closed = true;
        pipWindow = null;
        this.dispatchEvent(new Event('pagehide'));
      },
      resizeTo: function(w: number, h: number) {
        this.innerWidth = w;
        this.innerHeight = h;
      },
      addEventListener: function(type: string, listener: any) {
        if (!this._listeners[type]) this._listeners[type] = [];
        this._listeners[type].push(listener);
      },
      removeEventListener: function(type: string, listener: any) {
        if (this._listeners[type]) {
          this._listeners[type] = this._listeners[type].filter((l: any) => l !== listener);
        }
      },
      dispatchEvent: function(e: Event) {
        if (this._listeners[e.type]) {
          this._listeners[e.type].forEach((l: any) => l(e));
        }
        return true;
      },
      _listeners: {} as Record<string, any[]>
    };

    pipWindow = win;
    return win as unknown as Window;
  };

  Object.defineProperty(window, 'documentPictureInPicture', {
    value: {
      requestWindow: mockRequestWindow,
      get window() { return pipWindow; }
    },
    writable: true,
    configurable: true
  });
};

export const clearMockDocumentPictureInPicture = () => {
  delete (window as any).documentPictureInPicture;
};
