export type AttributeValue = string | null;

export interface Attributes {
  [index: string]: AttributeValue;
}

/**
 * A wrapper for a given element, which allows to store changes to be applied
 * to the DOM structure later on.
 */
export default class MutableElement {
  private readonly _delegate: Element;
  /**
   * If the name is set to empty string, the element itself is removed,
   * but its children added to the element's parent. If the name is set
   * and different to the original tag-name, the original element will
   * be replaced with the new element having the same attributes and
   * children as the element before.
   *
   * The default value `undefined` signals, to keep the element as is.
   *
   * A value of `null` signals to remove the element.
   */
  private _name: string | null | undefined = undefined;
  /**
   * Overrides for attribute values.
   */
  private _attributes: Attributes = {};

  /**
   * Constructor.
   *
   * @param delegate the original element to wrap
   */
  constructor(delegate: Element) {
    this._delegate = delegate;
  }

  /**
   * Persists the changes, as requested.
   *
   * @return the original element, the replaced element, or the first element of the children, attached to the original parent; `null` when replaced by children, but no children existed.
   */
  persist(): Element | null {
    const newName = this._name;
    if (newName === undefined) {
      return this.persistAttributes();
    }
    if (newName === null) {
      return this.persistDeletion();
    }
    if (this.replaceByChildren) {
      return this.persistReplaceByChildren();
    }
    return this.persistReplaceBy(newName);
  }

  private persistAttributes(): Element {
    Object.keys(this._attributes).forEach((key: string) => {
      const value: AttributeValue = this._attributes[key];
      if (value === null) {
        this._delegate.removeAttribute(key);
      } else {
        this._delegate.setAttribute(key, value);
      }
    });
    return this._delegate;
  }

  private persistDeletion(): null {
    const parentElement = this._delegate.parentElement;
    if (!!parentElement) {
      parentElement.removeChild(this._delegate);
    }
    return null;
  }

  private persistReplaceByChildren(): Element | null {
    const parentElement = this._delegate.parentElement;
    if (!parentElement) {
      // Cannot apply. Assume, that the element shall just vanish.
      return null;
    }
    const childrenToMove = this._delegate.children;
    let firstChild: Element | null = null;
    for (let i = 0; i < childrenToMove.length; i++) {
      const child = childrenToMove.item(i);
      if (!!child) {
        // Will also remove it from original parent.
        parentElement.insertBefore(child, this._delegate);
        if (!firstChild) {
          firstChild = child;
        }
      }
    }
    parentElement.removeChild(this._delegate);
    return firstChild;
  }

  private persistReplaceBy(newName: string): Element {
    const newElement = this._delegate.ownerDocument.createElement(newName);
    const attributesToCopy = this.attributes;
    Object.keys(attributesToCopy).forEach((key: string) => {
      const value = attributesToCopy[key];
      if (value !== null) {
        newElement.setAttribute(key, value);
      }
    });
    const parentElement = this._delegate.parentElement;
    if (!!parentElement) {
      parentElement.insertBefore(newElement, this._delegate);
      parentElement.removeChild(this._delegate);
    }
    return newElement;
  }

  /**
   * Get direct access to the delegate element.
   */
  get element(): Element {
    return this._delegate;
  }

  /**
   * Signals, if this mutable element represents a state, where the element
   * shall be removed, while attaching the children to the parent node.
   */
  get replaceByChildren(): boolean {
    return this._name === "";
  }

  /**
   * Sets, if this mutable element represents a state, where the element
   * shall be removed, while attaching the children to the parent node.
   *
   * Convenience: If `true`, the name of this mutable element will be set
   * to empty. Thus, if you change the name afterwards, this state will
   * be reset.
   *
   * @param b `true` to mark as <em>replace with children</em>; `false` otherwise.
   */
  set replaceByChildren(b: boolean) {
    this._name = b ? "" : undefined;
  }

  /**
   * Signals, if this element shall be replaced with a new element of
   * different name.
   */
  get replace(): boolean {
    return !!this._name && this._name.toLowerCase() !== this._delegate.tagName.toLowerCase();
  }

  /**
   * Signals, if this mutable element represents a state, where the element
   * shall be removed, including all its children.
   */
  get remove(): boolean {
    return this._name === null;
  }

  /**
   * Sets, if this mutable element represents a state, where the element
   * shall be removed, including all its children.
   *
   * Convenience: If `true`, the name of this mutable element will be set
   * to `null`. Thus, if you change the name afterwards, this state will
   * be reset.
   *
   * @param b `true` to mark as <em>to remove</em>; `false` otherwise.
   */
  set remove(b: boolean) {
    this._name = b ? null : undefined;
  }

  /**
   * Access parent element.
   */
  get parent(): HTMLElement | null {
    return this._delegate.parentElement;
  }

  /**
   * Access children of element.
   */
  get children(): HTMLCollection {
    return this._delegate.children;
  }

  /**
   * Retrieve the name of the element.
   * If the name got changed, will return this changed name instead.
   */
  get name(): string | null {
    return this._name || this._delegate.tagName;
  }

  /**
   * Set a new name for this element. Setting a name different to the original
   * name signals, that in the end the delegate element shall be replaced by
   * the new element.
   *
   * @param newName new name for the element; case does not matter; empty string will signal to replace
   * the element by its children; `null` signals to remove the element completely.
   */
  set name(newName: string | null) {
    this._name = newName;
  }

  /**
   * Provides access to the attributes of the element. Any modifications are
   * interpreted as <em>modification requests</em>, thus, they are not directly
   * forwarded to the element, but need to be persisted later on.
   *
   * Setting an attribute to a new value, will change the value later on.
   * Deleting an attribute, or setting its value to `null` will later
   * remove the attribute from the element.
   */
  get attributes(): Attributes {
    const element: Element = this._delegate;
    return new Proxy(this._attributes, {
      defineProperty(target: Attributes, p: PropertyKey, attributes: PropertyDescriptor): boolean {
        return Reflect.defineProperty(target, p, attributes);
      },
      /**
       * Retrieves the current attribute value. It is either the overwritten
       * value, or, if not overwritten, the original value.
       */
      get(target: Attributes, attrName: PropertyKey, receiver: never): AttributeValue {
        if (Reflect.has(target, attrName)) {
          return Reflect.get(target, attrName, receiver);
        }
        if (typeof attrName === "string") {
          return element.getAttribute(attrName);
        }
        return null;
      },
      /**
       * Gets the property descriptor for the given property. This is
       * especially used, when looping over the attributes and accessing
       * and/or modifying them.
       */
      getOwnPropertyDescriptor(target: Attributes, attrName: PropertyKey): PropertyDescriptor | undefined {
        // Handle, if this is the overwritten state.
        if (Reflect.has(target, attrName)) {
          const value = Reflect.get(target, attrName);
          if (value === undefined || value === null) {
            return undefined;
          }
          return {
            configurable: true,
            enumerable: true,

            get(): unknown {
              return value;
            },

            set(v: unknown): void {
              Reflect.set(target, attrName, v);
            },
          };
        }
        // Fallback to original attributes.
        if (typeof attrName === "string" && element.hasAttribute(attrName)) {
          return {
            configurable: true,
            enumerable: true,

            get(): string | null {
              return element.getAttribute(attrName);
            },

            set(v: unknown): void {
              Reflect.set(target, attrName, v);
            },
          };
        }
        // Key is of type we cannot handle for original attributes: Thus, we signal not knowing it.
        return undefined;
      },
      /**
       * Sets a specific property, and thus overrides it. Setting it to
       * `null` is the same as deleting it.
       */
      set(target: Attributes, p: PropertyKey, value: unknown): boolean {
        return Reflect.set(target, p, value);
      },
      /**
       * Deletes the property. Thus, if existing, marks it as <em>to-be-deleted</em>.
       */
      deleteProperty(target: Attributes, p: PropertyKey): boolean {
        return Reflect.set(target, p, null);
      },
      /**
       * Signals, if this property is available. Excludes any previously
       * deleted properties.
       */
      has(target: Attributes, p: PropertyKey): boolean {
        if (Reflect.has(target, p)) {
          return Reflect.get(target, p) !== null;
        }
        if (typeof p === "string") {
          return element.hasAttribute(p) !== null;
        }
        return false;
      },
      /**
       * Provides all existing attributes names, skipping those, which got
       * marked for deletion.
       */
      ownKeys(target: Attributes): PropertyKey[] {
        const targetKeys: PropertyKey[] = Reflect.ownKeys(target);
        const elementAttrs: PropertyKey[] = element.getAttributeNames();
        // Join distinct keys, skip forcibly deleted.
        return elementAttrs
          .concat(targetKeys.filter((k: PropertyKey) => elementAttrs.indexOf(k) < 0))
          .filter((k: PropertyKey) => !Reflect.has(target, k) || Reflect.get(target, k) !== undefined);
      },
    });
  }
}
