import { Schema, Struct } from '@strapi/strapi';

export type ExtractSchema<T> = T extends Schema.Attribute.Integer
  ? number
  : T extends Schema.Attribute.BigInteger
    ? string
    : T extends Schema.Attribute.Decimal
      ? number
      : T extends Schema.Attribute.Boolean
        ? boolean
        : T extends Schema.Attribute.String
          ? string
          : T extends Schema.Attribute.Text
            ? string
            : T extends Schema.Attribute.RichText
              ? string
              : T extends Schema.Attribute.Date
                ? string
                : T extends Schema.Attribute.Time
                  ? string
                  : T extends Schema.Attribute.DateTime
                    ? string
                    : T extends Schema.Attribute.Relation
                      ? any
                      : T extends Schema.Attribute.Component<any, true>
                        ? any[]
                        : T extends Schema.Attribute.Component<any>
                          ? any
                          : T;
export type CollectionType<T extends Struct.CollectionTypeSchema> = {
  id: number;
  documentId: string;
} & {
  [key in keyof T['attributes']]: ExtractSchema<T['attributes'][key]>;
};
