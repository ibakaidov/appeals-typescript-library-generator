// schema.ts

/**
 * Главный интерфейс, описывающий корневой объект схемы.
 */
export interface ISchema {
    models: IModel[];
  }
  
  /**
   * Описывает модель из массива "models".
   */
  export interface IModel {
    model_name: string;
    fields: IField[];
    edges: IEdge[];
  }
  
  /**
   * Описывает поле модели (например, AppealNumber, MailNumber и т.д.).
   */
  export interface IField {
    field_name: string;
    type: string
    is_optional: boolean;
  }
  
  /**
   * Описывает связь между моделями (например, recipient, source и т.д.).
   */
  export interface IEdge {
    edge_name: string;
    type: string;
    direction: string; // например, "to" или "from"
  }
  