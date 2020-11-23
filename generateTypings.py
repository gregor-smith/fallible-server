from argparse import ArgumentParser


def main():
    parser = ArgumentParser()
    parser.add_argument('--overloads', type=int, default=9)
    overloads: int = parser.parse_args().overloads

    for i in range(1, overloads + 1):
        print('export function composeMessageHandlers<')
        print('    ExistingState,')
        for j in range(1, i + 2):
            print(f'    NewState{j}, Errors{j},')
        print('>(')
        print('    handlers: [')
        print('        MessageHandler<ExistingState, NewState1, Errors1>,')
        for j in range(1, i + 1):
            joined_states = ' & '.join(f'NewState{k}' for k in range(1, j + 1))
            joined_errors = ' | '.join(f'Errors{k}' for k in range(1, j + 2))
            print(f'        MessageHandler<ExistingState & {joined_states}, NewState{j + 1}, {joined_errors}>,')
        print('    ],')
        print('    composeCleanupErrors: (')
        joined_errors = ' | '.join(f'Errors{j}' for j in range(1, i + 2))
        print(f'        errors: ReadonlyArray<Readonly<{joined_errors}>>')
        print(f'    ) => Awaitable<{joined_errors}>')
        print('): MessageHandler<')
        print('    ExistingState,')
        joined_state = ' & '.join(f'NewState{j}' for j in range(1, i + 2))
        print(f'    {joined_state},')
        print(f'    {joined_errors}')
        print('>')


if __name__ == "__main__":
    main()
