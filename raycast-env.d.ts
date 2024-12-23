/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `compress` command */
  export type Compress = ExtensionPreferences & {}
  /** Preferences accessible in the `speed` command */
  export type Speed = ExtensionPreferences & {}
  /** Preferences accessible in the `convert` command */
  export type Convert = ExtensionPreferences & {}
  /** Preferences accessible in the `resize` command */
  export type Resize = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `compress` command */
  export type Compress = {}
  /** Arguments passed to the `speed` command */
  export type Speed = {}
  /** Arguments passed to the `convert` command */
  export type Convert = {}
  /** Arguments passed to the `resize` command */
  export type Resize = {}
}

