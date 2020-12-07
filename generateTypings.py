from argparse import ArgumentParser


def main():
    parser = ArgumentParser()
    parser.add_argument('--overloads', type=int, default=9)
    overloads: int = parser.parse_args().overloads

    for i in range(1, overloads + 1):
        print('export function composeMessageHandlers<')
        for j in range(1, i + 1):
            print(f'    State{j}, Error{j},')
        print(f'    State{i + 1}')
        print('>(')
        print('    handlers: [')
        for j in range(1, i + 1):
            joined_errors = ' | '.join(f'Error{k}' for k in range(1, j + 1))
            print(f'        MessageHandler<State{j}, State{j + 1}, {joined_errors}>,')
        print('    ],')
        print('    composeCleanupErrors: (')
        print(f'        errors: ReadonlyArray<Readonly<{joined_errors}>>')
        print(f'    ) => Awaitable<{joined_errors}>')
        print('): MessageHandler<')
        print('    State1,')
        print(f'    State{i + 1},')
        print(f'    {joined_errors}')
        print('>')


if __name__ == "__main__":
    main()
