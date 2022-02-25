const
    PREC = {
        primary: 7,
        unary: 6,
        multiplicative: 5,
        additive: 4,
        comparative: 3,
        and: 2,
        or: 1,
        composite_literal: -1,
    },
    comparative_operators = ['<', '<=', '<>', '=', '>=', '>'],
    squote = "'",
    dquote = "\"",
    dot = ".",
    star = "*",

    if_not_exists = seq(kw( "IF"),kw("NOT"),kw("EXISTS")),
    if_exists = seq(kw( "IF"),kw("EXISTS")),
    or_replace = seq(kw( "OR"),kw("REPLACE")),

    string_str =  seq(squote, field("content", /[^']*/), squote),

    uuid_str = /[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}/,
    hex_digit = /[0-9a-fA-F]/,
    decimal_digits = /[0-9]+/,
    hex_str = choice(
        seq(
            "X'",
            repeat1(
                seq(
                    hex_digit,
                    hex_digit,
                )
            ),
            squote,
        ),
        seq(
            "0X",
            repeat1( hex_digit ),
        ),
    ),
    decimal_str =  seq( optional("-"), decimal_digits),
    float_str  = seq( optional("-"), decimal_digits, dot ,decimal_digits),
    code  =  seq( "$$",/(\$?[^$]+)+/, "$$"),
    name_chars  = /[a-zA-Z][A-Za-z0-9_$]*/

    module.exports = grammar({
    name: 'cql',

    conflicts: ($, original) => original.concat([
    ]),
    rules: {
        source_file: $ => repeat($._statement),

        _statement: $ =>
            seq(
                choice(
                    $.alter_keyspace,
                    $.alter_materialized_view,
                    $.alter_role,
                    $.alter_table,
                    $.alter_type,
                    $.alter_user,
                    $.apply_batch,
                    $.create_aggregate,
                    $.create_function,
                    $.create_index,
                    $.create_keyspace,
                    $.create_materialized_view,
                    $.create_role,
                    $.create_table,
                    $.create_trigger,
                    $.create_type,
                    $.create_user,
                    $.delete_statement,
                    $.drop_aggregate,
                    $.drop_function,
                    $.drop_index,
                    $.drop_keyspace,
                    $.drop_materialized_view,
                    $.drop_role,
                    $.drop_table,
                    $.drop_trigger,
                    $.drop_type,
                    $.drop_user,
                    $.grant,
                    $.insert_statement,
                    $.list_permissions,
                    $.list_roles,
                    $.revoke,
                    $.select_statement,
                    $.truncate,
                    $.update,
                    $.use,
                ),
                optional(";"),
            ),

        select_statement: $ =>
            seq(
                kw("SELECT"),
                optional( kw("DISTINCT")),
                optional( kw("JSON") ),
                $.select_elements,
                $.from_spec,
                optional($.where_spec),
                optional($.order_spec),
                optional($.limit_spec ),
                optional(seq( kw("ALLOW"), kw("FILTERING"))),
            ),
        limit_spec: $ => seq( kw("LIMIT"),$.decimal_literal),
        select_elements: $ =>
            seq(
            choice( star, $.select_element),
            repeat(seq(",", $.select_element)),
            ),
        select_element: $ =>
            choice(
                seq(
                    $.object_name,
                    dot,
                    star
                ),
                seq(
                    choice( $.object_name, $.function_call),
                    optional( seq( kw("AS"), $.object_name )),
                ),
            ),
        function_call: $ =>
            seq(
                alias( $.object_name, "function_name"),
                "(",
                choice(
                    star,
                    $.function_args,
                ),
                ")",
            ),
        function_args: $ =>
            commaSep1(choice(
                $.constant,
                $.object_name,
                $.function_call,
            )),
        constant: $ =>
            choice(
                $.decimal_literal,
                $.float_literal,
                $.hexadecimal_literal,
                $.boolean_literal,
                $.code_block,
                kw("NULL"),
                $.string_literal,
                $.uuid,
            ),
        uuid : $ =>token(uuid_str ),
        string_literal: $ => token(string_str),
        decimal_literal : $ =>  token( decimal_str ),
        float_literal : $ => token( float_str),
        hexadecimal_literal : $ => token(hex_str),
        boolean_literal : $ => token(choice( kw("TRUE"), kw("FALSE"))),
        code_block : $ => token( code ),
        object_name : $ => token( choice( name_chars, seq(squote, name_chars, squote))),
        from_spec : $ => seq( kw("FROM"),
            dotted_name( "table" )),
        where_spec : $ => seq( kw("WHERE"), $.relation_elements),
        relation_elements : $ => prec.left(PREC.and,sep1( $.relation_element, kw("AND"))),
        relation_element : $=>
            choice (
                seq(
                    choice(
                        dotted_name( "table" ),
                        $.function_call
                    ),
                    field("operator", choice("<", "<=", "<>", "=", ">", ">=")),
                    $.constant,
                ),
                seq(
                    $.function_call,
                    field("operator", choice("<", "<=", "<>", "=", ">", ">=")),
                    $.function_call,
                ),
                seq(
                    $.object_name,
                    kw("IN"),
                    "(",
                     $.function_args,
                    ")",
                ),
                seq(
                    "(",
                    commaSep1( $.object_name ),
                    ")",
                    kw("IN"),
                    "(",
                    commaSep1($.assignment_tuple),
                    ")",
                ),
                seq(
                    "(",
                    commaSep1( $.object_name ),
                    ")",
                    field("operator", choice("<", "<=", "<>", "=", ">", ">=")),
                    commaSep1($.assignment_tuple),
                ),
                $.relation_contains_key,
                $.relation_contains,
            ),
       assignment_tuple : $ =>
            seq(
                "(",
                $.constant,
                choice (
                    repeat( seq( ",", $.constant)),
                    repeat( seq( ",", $.assignment_tuple)),
                    seq(
                        $.assignment_tuple, repeat( seq(",", $.assignment_tuple))
                    )
                ),
                ")",
            ),
        relation_contains_key : $ => seq( $.object_name, kw("CONTAINS"),kw("KEY"), $.constant),
        relation_contains : $ => seq( $.object_name, kw("CONTAINS"), $.constant),
        order_spec : $ => seq ( kw("ORDER"),kw("BY"), $.order_spec_element),
        order_spec_element : $ => seq( $.object_name, optional( $.order_direction)),
        delete_statement : $ =>
            seq(
                optional( $.begin_batch ),
                kw("DELETE"),
                optional( $.delete_column_list ),
                $.from_spec,
                optional( $.using_timestamp_spec),
                $.where_spec,
                optional( choice( if_exists, $.if_spec))
            ),
        begin_batch : $ =>
            seq(
                kw("BEGIN"),
                optional( choice( kw("LOGGED"), kw("UNLOGGED"))),
                kw( "BATCH"),
                optional( $.using_timestamp_spec),
            ),
        delete_column_list : $ => seq( $.delete_column_item, repeat( seq( ",", $.delete_column_item))),
        delete_column_item : $ =>
            seq(
                $.object_name,
                optional(
                    seq(
                        "[",
                        choice( $.string_literal, $.decimal_literal),
                        "]"
                    )
                ),
            ),
        using_timestamp_spec : $ => seq( kw("USING"), $.timestamp ),
        timestamp : $ => seq( kw("TIMESTAMP"), $.decimal_literal),
        if_exist : $ => token( if_exists),
        if_spec : $ => seq( kw( "IF"), $.if_condition_list),
        if_condition_list : $ => seq( $.if_condition, repeat( seq( kw("AND"), $.if_condition))),
        if_condition : $ => seq( $.object_name, "=", $.constant),
        insert_statement : $ =>
            seq(
                optional( $.begin_batch),
                kw("INSERT"),
                kw("INTO"),
                dotted_name( "table"),
                optional( $.insert_column_spec ),
                $.insert_values_spec,
                optional( if_not_exists ),
                optional( $.using_ttl_timestamp )
            ),
        insert_column_spec : $ => seq( "(", $.column_list, ")" ),
        column_list : $ => commaSep1( alias( $.object_name, "column")),
        insert_values_spec : $ =>
            choice(
                seq( kw("VALUES"), "(", $.expression_list, ")", ),
                seq( kw("JSON"), $.constant),
            ),
        expression_list : $ => commaSep1( $.expression ),
        expression : $ =>
            choice(
                $.constant,
                $.assignment_map,
                $.assignment_set,
                $.assignment_list,
                $.assignment_tuple,
            ),
        assignment_map : $ => seq("{", commaSep1( seq( $.constant, ":", $.constant)),"}"),
        assignment_set : $ => seq("{", optional( commaSep1( $.constant ) ),"}"),
        assignment_list : $  => seq( "[", commaSep1( $.constant ), "]"),
        assignment_tuple : $ =>
            seq(
                "(",
                $.constant,
                choice(
                    repeat( seq( ",", $.constant)),
                    repeat( seq( ",", $.assignment_tuple)),
                    commaSep1( $.assignment_tuple ),
                ),
                ")",
            ),
        using_ttl_timestamp : $ =>
            seq(
                kw( "USING"),
                choice(
                    seq( $.ttl, optional( seq(kw("AND"), $.timestamp))),
                    seq( $.timestamp, optional( seq(kw("AND"), $.ttl))),
                )
            ),
        ttl : $ => seq( kw("TTL"), $.decimal_literal),
        truncate : $ =>
            seq(
                kw("TRUNCATE"),
                optional( kw ("TABLE") ),
                dotted_name( "table"),
            ),
        create_index : $ =>
            seq(
                kw( "CREATE"),
                kw("INDEX"),
                optional( if_not_exists ),
                optional( $.index_name ),
                kw( "ON"),
                dotted_name( "table"),
                "(",
                $.index_column_spec,
                ")",
            ),
        index_name : $ => alias( choice( $.object_name, $.string_literal), "index_name"),
        index_column_spec : $ => choice( alias($.object_name, "column"), $.index_keys_spec, $.index_entries_s_spec, $.index_full_spec),
        index_keys_spec : $ => seq( kw("KEYS"), "(", $.object_name, ")"),
        index_entries_s_spec : $ => seq( kw( "ENTRIES"), "(", $.object_name, ")"),
        index_full_spec : $ => seq( kw( "FULL"), "(", $.object_name, ")"),
        drop_index : $ =>
            seq(
                kw( "DROP"),
                kw("INDEX"),
                optional( if_exists ),
            seq( alias( token( choice( name_chars, seq(squote, name_chars, squote))), "keyspace"),
                ".", alias($.index_name, "index") ),
            alias( token( choice( name_chars, seq(squote, name_chars, squote))), "index" ),
        ),
        update : $ =>
            seq (
                optional( $.begin_batch),
                kw( "UPDATE"),
                dotted_name( "table"),
                optional( $.using_ttl_timestamp),
                kw( "SET"),
                commaSep1( $.assignment_element),
                $.where_spec,
                optional( choice( if_exists, $.if_spec))
            ),
        assignment_element : $ =>
            choice(
                seq( $.object_name, "=", choice( $.constant, $.assignment_map, $.assignment_set, $.assignment_list )),
                seq( $.object_name, "=", $.object_name, choice( "+", "-" ), $.decimal_literal),
                seq( $.object_name, "=", $.object_name, choice( "+", "-" ), $.assignment_set),
                seq( $.object_name, "=", $.assignment_set, choice( "+", "-" ), $.object_name),
                seq( $.object_name, "=", $.object_name, choice( "+", "-" ), $.assignment_map),
                seq( $.object_name, "=", $.assignment_map, choice( "+", "-" ), $.object_name),
                seq( $.object_name, "=", $.object_name, choice( "+", "-" ), $.assignment_list),
                seq( $.object_name, "=", $.assignment_list, choice( "+", "-" ), $.object_name),
                seq( $.object_name, "[", $.decimal_literal, "]", "=", $.constant),
            ),
        use : $ => seq( kw("USE"), alias($.object_name, "keyspace")),
        grant : $ => seq( kw("GRANT"), $.priviledge,  kw("ON"), $.resource, kw("TO"), alias( $.object_name, "role") ),
        priviledge : $ =>
            choice(
                choice(
                    kw("ALL"),
                    seq( kw( "ALL"),kw("PERMISSIONS")),
                ),
                kw( "ALTER"),
                kw( "AUTHORIZE"),
                kw( "DESCRIBE"),
                kw( "EXECUTE"),
                kw( "CREATE"),
                kw( "DROP"),
                kw( "MODIFY"),
                kw( "SELECT"),
            ),
        resource : $ =>
            choice(
                seq( kw("ALL"),kw("FUNCTIONS")),
                seq( kw("ALL"),kw("FUNCTIONS"),kw("IN"),kw("KEYSPACE"), alias( $.object_name, "keyspace")),
                seq( kw("FUNCTION"), dotted_name( "function" )),
                seq(kw("ALL"),kw("KEYSPACES")),
                seq( kw("KEYSPACE"), alias( $.object_name, "keyspace")),
                seq( optional( kw("TABLE")), dotted_name( "table")),
                seq( kw("ALL"), kw("ROLES")),
                seq( kw("ROLE"), alias( $.object_name, "role") ),
            ),
        revoke : $ => seq( kw("REVOKE"), $.priviledge, kw("ON"), $.resource, kw("FROM"), alias( $.object_name, "role")),
        list_roles : $ =>
            seq(
                kw("LIST"),
                kw("ROLES"),
                optional( seq( kw("OF"), alias( $.object_name, "role"))),
                optional( kw( "NORECURSIVE")),
            ),
        list_permissions : $ =>
            seq(
                kw("LIST"),
                $.priviledge,
                optional( seq( kw("ON"), $.resource)),
                optional( seq( kw( "OF"), alias( $.object_name, "role")))
            ),
        drop_aggregate : $ =>
            seq(
                kw( "DROP"),
                kw( "AGGREGATE"),
                optional( if_exists ),
                dotted_name( "aggregate"),
            ),
        drop_materialized_view : $ =>
            seq(
                kw( "DROP"),
                kw( "MATERIALIZED"),
                kw( "VIEW"),
                optional( if_exists ),
                dotted_name( "materialized_view"),
            ),
        drop_function : $ =>
            seq(
                kw( "DROP"),
                kw( "FUNCTION"),
                optional( if_exists ),
                dotted_name( "function"),
            ),
        drop_keyspace : $ =>
            seq(
                kw( "DROP"),
                kw( "KEYSPACE"),
                optional( if_exists ),
                alias( $.object_name, "keyspace"),
            ),
        drop_role : $ =>
            seq(
                kw( "DROP"),
                kw( "ROLE"),
                optional( if_exists ),
                alias( $.object_name, "role"),
            ),
        drop_table : $ =>
            seq(
                kw( "DROP"),
                kw( "TABLE"),
                optional( if_exists ),
                dotted_name( "table"),
            ),
        drop_trigger : $ =>
            seq(
                kw( "DROP"),
                kw( "TRIGGER"),
                optional( if_exists ),
                dotted_name( "trigger"),
                kw( "ON"),
                dotted_name( "table"),
            ),

        drop_type : $ =>
            seq(
                kw( "DROP"),
                kw( "TYPE"),
                optional( if_exists ),
                dotted_name( "type"),
            ),
        drop_user : $ =>
            seq(
                kw( "DROP"),
                kw("USER"),
                optional( seq(kw( "IF"),kw("EXISTS")), ),
        choice(
            seq( alias( $.object_name, "keyspace"),
                ".", alias($.object_name, "user") ),
            alias($.object_name, "user") ),


        //dotted_name( "user"),
            ),
        create_aggregate : $ =>
            seq(
                kw("CREATE"),
                optional( or_replace ),
                kw("AGGREGATE"),
                optional( if_not_exists ),
                dotted_name( "aggregate"),
                "(",
                $.data_type,
                ")",
                kw( "SFUNC"),
                alias( $.object_name, "sfunc"),
                kw( "STYPE"),
                $.data_type,
                kw( "FINALFUNC"),
                alias( $.object_name, "finalfunc"),
                kw("INITCOND"),
                $.init_cond_definition,
            ),
        init_cond_definition : $ =>
            choice(
                $.constant,
                $.init_cond_list,
                $.init_cond_list_nested,
                $.init_cond_hash,
            ),
        init_cond_list : $ => seq( "(", commaSep1( $.constant), ")"),
        init_cond_list_nested : $ =>
            seq(
                "(",
                $.init_cond_list,
                repeat( seq( ",", choice( $.constant, $.init_cond_list))),
                ")"
            ),
        init_cond_hash : $ =>
            seq(
                "(",
                commaSep1( $.init_cond_hash_item ),
                ")"
            ),
        init_cond_hash_item : $ => seq( alias( $.object_name,"hash_key"), ":", $.init_cond_definition ),
        create_materialized_view : $ =>
            seq(
                kw("CREATE"),
                kw("MATERIALIZED"),
                kw("VIEW"),
                optional( if_not_exists),
                dotted_name( "materialized_view"),
                kw( "AS"),
                kw( "SELECT"),
                $.column_list,
                kw( "FROM"),
                dotted_name( "table"),
                $.materialized_view_where,
                kw( "PRIMARY"),
                kw( "KEY"),
                "(",
                $.column_list,
                ")",
                optional( seq( kw("WITH"), $.materialized_view_options)),
            ),
        materialized_view_where : $ =>
            seq(
                kw("WHERE"),
                $.column_not_null_list,
                optional( seq( kw("AND"), $.relation_element)),
            ),
        column_not_null_list : $ => prec.left(PREC.and,sep1( $.column_not_null, kw("AND"))),
        column_not_null : $ => seq( alias($.object_name, "column"), kw("IS"), kw("NOT"), kw("NULL")),
        materialized_view_options : $ =>
            choice(
                $.table_options,
                seq( $.table_options, kw("AND"), $.clustering_order ),
                $.clustering_order
            ),
        create_function : $ =>
            seq(
                kw("CREATE"),
                optional( or_replace ),
                kw( "FUNCTION"),
                optional( if_not_exists ),
                dotted_name( "function"),
                "(",
                optional( commaSep1( $.param ) ),
                ")",
                $.return_mode,
                kw( "RETURNS"),
                $.data_type,
                kw("LANGUAGE"),
                alias( $.object_name, "language"),
                kw( "AS"),
                $.code_block,
            ),
        param : $ =>
            seq(
                alias( $.object_name, "param_name"),
                $.data_type
            ),
        data_type : $ => seq( $.data_type_name, optional($.data_type_definition)),
        data_type_name : $ =>
            choice (
                $.object_name,
                kw( "TIMESTAMP"),
                kw( "SET"),
                kw( "ASCII"),
                kw( "BIGINT"),
                kw( "BLOB"),
                kw( "BOOLEAN"),
                kw( "COUNTER"),
                kw( "DATE"),
                kw( "DECIMAL"),
                kw( "DOUBLE"),
                kw( "FLOAT"),
                kw( "FROZEN"),
                kw( "INET"),
                kw( "INT"),
                kw( "LIST"),
                kw( "MAP"),
                kw( "SMALLINT"),
                kw( "TEXT"),
                kw( "TIME"),
                kw( "TIMEUUID"),
                kw( "TINYINT"),
                kw( "TUPLE"),
                kw( "VARCHAR"),
                kw( "VARINT"),
                kw( "TIMESTAMP"),
                kw( "UUID"),
            ),
        data_type_definition : $ => seq( "<", commaSep1( $.data_type_name), ">"),
        return_mode : $ =>
            seq(
                choice(
                    kw("CALLED"),
                    seq(
                        kw( "RETURNS"),
                        kw( "NULL"),
                    ),
                ),
                kw( "ON"),
                kw( "NULL"),
                kw( "INPUT"),
            ),
        create_keyspace : $ =>
            seq(
                kw("CREATE"),
                kw( "KEYSPACE"),
                optional( if_not_exists ),
                alias( $.object_name, "keyspace" ),
                kw( "WITH"),
                kw( "REPLICATION"),
                ">",
                "{",
                $.replication_list,
                "}",
                optional( seq( kw("AND"), $.durable_writes)),
            ),
        replication_list_item : $ =>
            choice(
                seq( $.string_literal, ":", $.string_literal),
                seq( $.string_literal, ":", $.decimal_literal),
            ),
        durable_writes : $ =>
            seq(
                kw("DURABLE_WRITES"),
                "=",
                $.boolean_literal,
            ),
        create_role : $ =>
            seq(
                kw("CREATE"),
                kw("ROLE"),
                optional( if_not_exists),
                alias( $.object_name, "role"),
                optional( $.role_with ),
            ),
        role_with : $ => seq( kw("WITH"), commaSep1( $.role_with_options)),
        role_with_options : $ =>
            choice(
                seq( kw("PASSWORD"), "=", $.string_literal),
                seq( kw("LOGIN"), "=", $.boolean_literal),
                seq( kw("SUPERUSER"), "=", $.boolean_literal),
                seq( kw("OPTIONS"), "=", $.option_hash),
            ),
        option_hash : $ => seq( "(", commaSep1( $.option_hash_item), ")"),
        option_hash_item : $ => seq( $.string_literal, ":", choice( $.string_literal, $.float_literal), ")"),
        create_table : $ =>
            seq(
                kw("CREATE"),
                kw("TABLE"),
                optional( if_not_exists ),
                dotted_name( "table"),
                "(",
                $.column_definition_list,
                ")",
                optional( $.with_element),
            ),
        column_definition_list : $ =>
            seq(
                commaSep1( $.column_definition),
                optional( seq( ",", $.primary_key_element)),
            ),
        column_definition : $ => seq( alias($.object_name, "column"), $.data_type, optional( $.primary_key_column)),
        primary_key_column : $ => seq( kw("PRIMARY"), kw("KEY")),
        primary_key_element : $ =>
            seq(
                kw("PRIMARY"),
                kw("KEY"),
                "(",
                $.primary_key_definition,
                ")",
            ),
        primary_key_definition : $ => choice( alias($.object_name, "primary_key"), $.compound_key, $.composite_key ),
        compound_key : $ => seq( alias( $.object_name,"partition_key"), ",", $.clustering_key_list ),
        clustering_key_list : $ => alias( commaSep1( $.object_name ), "clustering_key"),
        composite_key : $ =>
            seq(
                "(",
                $.partition_key_list,
                ")",
                ",",
                $.clustering_key_list
            ),
        partition_key_list : $ => alias( commaSep1( $.object_name), "partition_key"),
        with_element : $ => seq( kw("WITH"), optional( $.table_options), optional( $.clustering_order)),
        table_options : $ => prec.left(PREC.and,sep1( $.table_option_item, kw("AND"))),
        table_option_item : $ =>
            choice(
                seq( $.table_option_name, "=", $.table_option_value ),
                seq( $.table_option_name, "=", $.option_hash ),
            ),
        table_option_name : $ => alias( $.object_name, "option"),
        table_option_value : $ => choice( $.string_literal, $.float_literal ),
        clustering_order : $ =>
            seq(
                kw("CLUSTERING"),
                kw( "ORDER"),
                kw( "BY"),
                "(",
                alias( $.object_name, "column" ),
                optional( $.order_direction ),
                ")",
            ),
        order_direction : $ => choice( kw( "ASC"), kw("DESC")),
        create_trigger : $ =>
            seq(
                kw("CREATE"),
                kw( "TRIGGER"),
                optional( if_not_exists ),
                dotted_name( "trigger"),
                kw( "USING"),
                alias( $.object_name, "trigger_class"),
            ),
        create_type : $ =>
            seq(
                kw("CREATE"),
                kw("TYPE"),
                optional( if_not_exists ),
                dotted_name( "type"),
                "(",
                commaSep1( seq( alias( $.object_name, "column"), alias( $.data_type, "data_type")) ),
                ")",
            ),
        create_user : $ =>
            seq(
                kw("CREATE"),
                kw("USER"),
                optional( if_not_exists ),
                alias( $.object_name, "user"),
                kw( "WITH"),
                $.user_password,
                optional( $.user_super_user),
            ),
        alter_materialized_view : $ =>
            seq(
                kw("ALTER"),
                kw( "MATERIALIZED"),
                kw( "VIEW"),
                dotted_name( "materialized_view"),
                optional( seq( kw("WITH"), $.table_options))
            ),
        alter_keyspace : $ =>
            seq(
                kw("ALTER"),
                kw( "KEYSPACE"),
                alias( $.object_name, "keyspace"),
                kw("WITH"),
                kw("REPLICATION"),
                "=",
                "{",
                $.replication_list,
                "}",
                optional( seq( kw("AND"),$.durable_writes) ),
            ),
        replication_list : $ => commaSep1( $.replication_list_item ),
        alter_role : $ =>
            seq(
                kw("ALTER"),
                kw( "ROLE"),
                alias( $.object_name, "role"),
                optional( $.role_with ),
            ),
        alter_table : $ =>
            seq(
                kw("ALTER"),
                kw( "TABLE"),
                dotted_name( "table"),
                $.alter_table_operation,
            ),
        alter_table_operation : $ =>
            choice(
                $.alter_table_add,
                $.alter_table_drop_columns,
                $.alter_table_drop_compact_storage,
                $.alter_table_rename,
                $.alter_table_with,
            ),
        alter_table_add : $ => seq( kw("ADD"), $.alter_table_column_definition ),
        alter_table_column_definition : $ => commaSep1( seq( alias( $.object_name, "column"), $.data_type)),
        alter_table_drop_columns : $ => seq( kw("DROP"), $.alter_table_drop_column_list ),
        alter_table_drop_column_list : $ => commaSep1( alias( $.object_name, "column") ),
        alter_table_drop_compact_storage : $ => seq( kw("DROP"), kw("COMPACT"), kw("STORAGE") ),
        alter_table_rename : $ => seq( kw("RENAME"), alias( $.object_name, "column"), kw("TO"), alias( $.object_name, "column") ),
        alter_table_with : $ => seq( kw("WITH"), $.table_options ),
        alter_type : $ =>
            seq(
                kw("ALTER"),
                kw( "TYPE"),
                dotted_name( "type"),
                $.alter_type_operation,
            ),
        alter_type_operation : $ =>
            choice(
                $.alter_type_alter_type,
                $.alter_type_add,
                $.alter_type_rename,
            ),
        alter_type_alter_type : $ =>
            seq(
                kw("ALTER"),
                alias( $.object_name, "column"),
                kw("TYPE"),
                $.data_type,
            ),
        alter_type_add : $ =>
            seq(
                kw("ADD"),
                commaSep1( seq(alias( $.object_name, "column"), $.data_type,)),
            ),
        alter_type_rename : $ => seq( kw("RENAME"), $.alter_type_rename_list ),
        alter_type_rename_list : $ => sep1( $.alter_type_rename_item, kw( "AND")),
        alter_type_rename_item : $ => seq( alias( $.object_name, "column"), kw("TO"), alias( $.object_name, "column") ),
        alter_user : $ =>
            seq(
                kw("ALTER"),
                kw( "USER"),
                alias($.object_name, "user"),
                kw("WITH"),
                $.user_password,
                optional( $.user_super_user ),
            ),
        user_password : $ => seq( kw("PASSWORD"), $.string_literal),
        user_super_user : $ => choice( kw("SUPERUSER"), kw("NOSUPERUSER")),
        apply_batch : $ => seq( kw("APPLY"), kw("BATCH")),
    },
});

function kw(keyword) {
    if (keyword.toUpperCase() != keyword) {
        throw new Error(`Expected upper case keyword got ${keyword}`);
    }
    const words = keyword.split(" ");
    const regExps = words.map(createCaseInsensitiveRegex);

    if (regExps.length == 1) {
        return alias(regExps[0], keyword);
    } else {
        return alias(seq(...regExps), keyword.replace(/ /g, "_"));
    }
}

function createCaseInsensitiveRegex(word) {
    return new RegExp(
        word
            .split("")
            .map(letter => `[${letter.toLowerCase()}${letter.toUpperCase()}]`)
            .join(""),
    );
}

function commaSep1(rule) {
    return sep1(rule, ",");
}

function sep1(rule, separator) {
    return seq(rule, repeat(seq(separator, rule)));
}

function dotted_name(name) {
    return choice(
        seq( alias( token( choice( name_chars, seq(squote, name_chars, squote))), "keyspace"),
            ".", alias(token( choice( name_chars, seq(squote, name_chars, squote))), name) ),
        alias( token( choice( name_chars, seq(squote, name_chars, squote))), name ),
    )
}