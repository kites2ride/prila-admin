/**
 * Minimal typings for the parts of the Google Maps JavaScript API the admin uses
 * (no @types/google.maps dependency). Add members here only when you use them.
 * Reference: https://developers.google.com/maps/documentation/javascript/reference
 */
declare namespace google.maps {
  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
    toJSON(): LatLngLiteral;
  }

  class LatLngBounds {
    constructor();
    extend(point: LatLng | LatLngLiteral): LatLngBounds;
    isEmpty(): boolean;
  }

  interface MapsEventListener {
    remove(): void;
  }

  interface MapMouseEvent {
    latLng: LatLng | null;
  }

  interface PolyMouseEvent extends MapMouseEvent {
    vertex?: number;
  }

  class MVCArray<T> {
    constructor(array?: T[]);
    getArray(): T[];
    getAt(i: number): T;
    getLength(): number;
    push(elem: T): number;
    pop(): T;
    removeAt(i: number): T;
    clear(): void;
    addListener(eventName: 'insert_at' | 'remove_at' | 'set_at', handler: () => void): MapsEventListener;
  }

  interface MapOptions {
    center?: LatLngLiteral;
    zoom?: number;
    mapId?: string;
    clickableIcons?: boolean;
    streetViewControl?: boolean;
    mapTypeControl?: boolean;
    fullscreenControl?: boolean;
    gestureHandling?: 'cooperative' | 'greedy' | 'none' | 'auto';
    draggableCursor?: string | null;
  }

  class Map {
    constructor(el: HTMLElement, opts?: MapOptions);
    setCenter(latLng: LatLngLiteral): void;
    setZoom(zoom: number): void;
    setOptions(opts: MapOptions): void;
    fitBounds(bounds: LatLngBounds, padding?: number): void;
    addListener(eventName: 'click', handler: (e: MapMouseEvent) => void): MapsEventListener;
    getZoom(): number | undefined;
  }

  interface PolygonOptions {
    map?: Map | null;
    paths?: LatLngLiteral[] | MVCArray<LatLng>;
    editable?: boolean;
    draggable?: boolean;
    clickable?: boolean;
    visible?: boolean;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    fillColor?: string;
    fillOpacity?: number;
    zIndex?: number;
  }

  class Polygon {
    constructor(opts?: PolygonOptions);
    setMap(map: Map | null): void;
    setOptions(opts: PolygonOptions): void;
    setVisible(v: boolean): void;
    getPath(): MVCArray<LatLng>;
    setPath(path: LatLngLiteral[] | MVCArray<LatLng>): void;
    addListener(eventName: 'click' | 'rightclick', handler: (e: PolyMouseEvent) => void): MapsEventListener;
  }

  interface CircleOptions {
    map?: Map | null;
    center?: LatLngLiteral;
    radius?: number;
    strokeColor?: string;
    strokeWeight?: number;
    strokeOpacity?: number;
    fillColor?: string;
    fillOpacity?: number;
    clickable?: boolean;
    zIndex?: number;
  }

  class Circle {
    constructor(opts?: CircleOptions);
    setMap(map: Map | null): void;
  }

  interface IconSequence {
    icon: { path: string; strokeOpacity?: number; strokeWeight?: number; scale?: number };
    offset?: string;
    repeat?: string;
  }

  interface PolylineOptions {
    map?: Map | null;
    path?: LatLngLiteral[];
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    icons?: IconSequence[];
    clickable?: boolean;
    zIndex?: number;
  }

  class Polyline {
    constructor(opts?: PolylineOptions);
    setMap(map: Map | null): void;
    setOptions(opts: PolylineOptions): void;
    addListener(eventName: 'click', handler: (e: MapMouseEvent) => void): MapsEventListener;
  }

  function importLibrary(name: 'maps' | 'marker' | 'core'): Promise<unknown>;

  namespace event {
    function clearInstanceListeners(instance: object): void;
  }

  namespace marker {
    interface AdvancedMarkerElementOptions {
      map?: Map | null;
      position?: LatLngLiteral | null;
      title?: string;
      content?: Node | null;
      zIndex?: number;
      gmpClickable?: boolean;
    }
    class AdvancedMarkerElement {
      constructor(opts?: AdvancedMarkerElementOptions);
      map: Map | null;
      position: LatLngLiteral | null;
      content: Node | null;
      title: string;
      zIndex: number | null;
      addListener(eventName: 'click', handler: () => void): MapsEventListener;
    }
  }
}
