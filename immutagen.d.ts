declare module "immutagen" {
  type ImmutaGenIterator<T, TReturn, TNext> = (...next: [TNext] | []) => ImmutaGen<T, TReturn, TNext>;

  // type ImmutaGen<T, TReturn, TNext> = {
  //   next: ImmutaGenIterator<T, TReturn, TNext>
  //   mutable: Generator<T, TReturn, TNext>
  // };
  
  const immutagen = <TArgs, T, TReturn, TNext>(gen: () => Generator<T, TReturn, TNext>) => (...args: TArgs): ImmutaGen<T, TReturn, TNext> => {};
  
  type ImmutaGen<T, TReturn, TNext> =
    | {
        value: T;
        // done: false;
        next: ImmutaGenIterator<T, TReturn, TNext>
        mutable: Generator<T, TReturn, TNext>
      }
    | {
        value: TReturn;
        // done: true;
        next: null;
        mutable: Generator<T, TReturn, TNext>
      };
  
  export { immutagen as default, immutagen, type ImmutaGen, type ImmutaGenIterator };
}
