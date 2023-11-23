export type Observer<T> = {
  update: (data: T) => void;
};

export class Observable<T> {
  private observers: Observer<T>[] = [];

  constructor(private data: T) {}

  subscribe(observer: Observer<T>) {
    this.observers.push(observer);
    observer.update(this.data);
  }

  update(data: T) {
    this.data = data;
    this.observers.forEach((o) => o.update(data));
  }
}

export const forwardObservable = <T>(o1: Observable<T>, o2: Observable<T>) => {
  o1.subscribe({
    update: (data) => o2.update(data),
  });
  return o1
}
